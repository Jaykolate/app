from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from pydantic import EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="MicroMarket API", description="Digital Wholesale Marketplace API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_SECRET = "micromarket_secret_key_2025"
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

security = HTTPBearer()

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    user_type: str  # 'vendor' or 'supplier'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    user_type: str  # 'vendor' or 'supplier'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    stall_name: str
    description: str
    image_url: str
    contact_phone: str
    location: str
    rating: float = 4.5
    delivery_rating: float = 4.2
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    name: str
    category: str
    price_per_unit: float
    unit: str  # kg, lbs, pieces, etc.
    quantity_available: int
    bulk_discount_tiers: List[dict] = []  # [{"min_qty": 10, "discount": 0.1}]
    image_url: str
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CartItem(BaseModel):
    product_id: str
    supplier_id: str
    quantity: int
    price_per_unit: float

class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    items: List[CartItem] = []
    total_amount: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        user_type=user_data.user_type
    )
    
    # Store user with hashed password
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    await db.users.insert_one(user_dict)
    
    # Create JWT token
    token = create_jwt_token(user.id, user.email)
    
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(login_data.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_doc)
    token = create_jwt_token(user.id, user.email)
    
    return Token(access_token=token, token_type="bearer", user=user)

# Supplier Routes
@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers():
    suppliers = await db.suppliers.find().to_list(100)
    return [Supplier(**supplier) for supplier in suppliers]

@api_router.get("/suppliers/{supplier_id}/products", response_model=List[Product])
async def get_supplier_products(supplier_id: str):
    products = await db.products.find({"supplier_id": supplier_id}).to_list(100)
    return [Product(**product) for product in products]

# Cart Routes
@api_router.get("/cart", response_model=Cart)
async def get_cart(current_user: User = Depends(get_current_user)):
    cart = await db.carts.find_one({"vendor_id": current_user.id})
    if not cart:
        # Create empty cart
        empty_cart = Cart(vendor_id=current_user.id)
        await db.carts.insert_one(empty_cart.dict())
        return empty_cart
    return Cart(**cart)

@api_router.post("/cart/add")
async def add_to_cart(cart_item: CartItem, current_user: User = Depends(get_current_user)):
    cart = await db.carts.find_one({"vendor_id": current_user.id})
    
    if not cart:
        # Create new cart
        new_cart = Cart(vendor_id=current_user.id, items=[cart_item])
        new_cart.total_amount = cart_item.quantity * cart_item.price_per_unit
        await db.carts.insert_one(new_cart.dict())
        return {"message": "Item added to cart"}
    
    # Update existing cart
    cart_obj = Cart(**cart)
    
    # Check if product already in cart
    existing_item = None
    for item in cart_obj.items:
        if item.product_id == cart_item.product_id:
            existing_item = item
            break
    
    if existing_item:
        existing_item.quantity += cart_item.quantity
    else:
        cart_obj.items.append(cart_item)
    
    # Recalculate total
    cart_obj.total_amount = sum(item.quantity * item.price_per_unit for item in cart_obj.items)
    cart_obj.updated_at = datetime.utcnow()
    
    await db.carts.replace_one({"vendor_id": current_user.id}, cart_obj.dict())
    return {"message": "Item added to cart"}

# Demo data initialization
@api_router.post("/demo/init")
async def initialize_demo_data():
    # Check if demo data already exists
    existing_suppliers = await db.suppliers.count_documents({})
    if existing_suppliers > 0:
        return {"message": "Demo data already exists"}
    
    # Create demo suppliers
    demo_suppliers = [
        {
            "id": str(uuid.uuid4()),
            "user_id": "demo_user_1",
            "stall_name": "Fresh Valley Farms",
            "description": "Premium fresh vegetables and herbs directly from our organic farm",
            "image_url": "https://images.unsplash.com/photo-1532079563951-0c8a7dacddb3",
            "contact_phone": "+1-555-0123",
            "location": "Central Market District",
            "rating": 4.8,
            "delivery_rating": 4.5,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": "demo_user_2", 
            "stall_name": "Tropical Fruits Paradise",
            "description": "Exotic fruits and seasonal produce from local and international sources",
            "image_url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9",
            "contact_phone": "+1-555-0456",
            "location": "East Market Zone",
            "rating": 4.6,
            "delivery_rating": 4.3,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": "demo_user_3",
            "stall_name": "Spice & Herb Corner",
            "description": "Authentic spices, dried herbs, and specialty seasonings for street food vendors",
            "image_url": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
            "contact_phone": "+1-555-0789",
            "location": "Spice Alley",
            "rating": 4.9,
            "delivery_rating": 4.7,
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.suppliers.insert_many(demo_suppliers)
    
    # Create demo products
    demo_products = []
    categories = ["Vegetables", "Fruits", "Spices", "Herbs"]
    
    for supplier in demo_suppliers:
        for i in range(5):
            product = {
                "id": str(uuid.uuid4()),
                "supplier_id": supplier["id"],
                "name": f"Product {i+1}",
                "category": categories[i % len(categories)],
                "price_per_unit": round(2.5 + (i * 1.2), 2),
                "unit": "kg",
                "quantity_available": 100 + (i * 20),
                "bulk_discount_tiers": [
                    {"min_qty": 10, "discount": 0.05},
                    {"min_qty": 25, "discount": 0.10},
                    {"min_qty": 50, "discount": 0.15}
                ],
                "image_url": supplier["image_url"],
                "description": f"Fresh {categories[i % len(categories)].lower()} from {supplier['stall_name']}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            demo_products.append(product)
    
    await db.products.insert_many(demo_products)
    
    return {"message": "Demo data initialized successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()