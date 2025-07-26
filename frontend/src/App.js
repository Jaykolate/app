import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (name, email, password, userType) => {
    try {
      const response = await axios.post(`${API}/auth/register`, {
        name,
        email,
        password,
        user_type: userType
      });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Components
const AuthModal = ({ isOpen, onClose, isLogin, setIsLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    userType: 'vendor'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        result = await register(formData.name, formData.email, formData.password, formData.userType);
      }

      if (result.success) {
        onClose();
        setFormData({ name: '', email: '', password: '', userType: 'vendor' });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isLogin ? 'Login' : 'Sign Up'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                I am a
              </label>
              <select
                value={formData.userType}
                onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="vendor">Vendor (Street Food Seller)</option>
                <option value="supplier">Supplier (Farmer/Wholesaler)</option>
              </select>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:bg-green-400"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-green-600 hover:text-green-700 text-sm"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SupplierCard = ({ supplier, onViewStall }) => (
  <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300">
    <div className="h-48 bg-gradient-to-br from-green-400 to-blue-500 relative overflow-hidden">
      <img
        src={supplier.image_url}
        alt={supplier.stall_name}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-full text-sm font-medium">
        ⭐ {supplier.rating}
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-bold text-lg mb-2 text-gray-800">{supplier.stall_name}</h3>
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{supplier.description}</p>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-gray-500">📍 {supplier.location}</span>
        <span className="text-xs text-gray-500">🚚 {supplier.delivery_rating}★</span>
      </div>
      <button
        onClick={() => onViewStall(supplier)}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
      >
        Visit Stall
      </button>
    </div>
  </div>
);

const ProductCard = ({ product, onAddToCart }) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden">
    <div className="h-32 bg-gradient-to-br from-yellow-400 to-orange-500 overflow-hidden">
      <img
        src={product.image_url}
        alt={product.name}
        className="w-full h-full object-cover"
      />
    </div>
    <div className="p-3">
      <h4 className="font-semibold text-md mb-1">{product.name}</h4>
      <p className="text-xs text-gray-600 mb-2">{product.category}</p>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-green-600">${product.price_per_unit}/{product.unit}</span>
        <span className="text-xs text-gray-500">{product.quantity_available} available</span>
      </div>
      <button
        onClick={() => onAddToCart(product)}
        className="w-full bg-orange-500 text-white py-2 px-3 rounded text-sm hover:bg-orange-600 transition-colors"
      >
        Add to Cart
      </button>
    </div>
  </div>
);

const VirtualMarket = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [], total_amount: 0 });
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();

  useEffect(() => {
    loadSuppliers();
    initializeDemoData();
  }, []);

  const initializeDemoData = async () => {
    try {
      await axios.post(`${API}/demo/init`);
    } catch (error) {
      console.error('Error initializing demo data:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await axios.get(`${API}/suppliers`);
      setSuppliers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setLoading(false);
    }
  };

  const loadSupplierProducts = async (supplierId) => {
    try {
      const response = await axios.get(`${API}/suppliers/${supplierId}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleViewStall = (supplier) => {
    setSelectedSupplier(supplier);
    loadSupplierProducts(supplier.id);
  };

  const handleAddToCart = async (product) => {
    if (!token) {
      alert('Please login to add items to cart');
      return;
    }

    try {
      const cartItem = {
        product_id: product.id,
        supplier_id: product.supplier_id,
        quantity: 1,
        price_per_unit: product.price_per_unit
      };

      await axios.post(`${API}/cart/add`, cartItem, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local cart state
      const newItem = { ...cartItem, name: product.name };
      const existingItemIndex = cart.items.findIndex(item => item.product_id === product.id);
      
      if (existingItemIndex >= 0) {
        const updatedItems = [...cart.items];
        updatedItems[existingItemIndex].quantity += 1;
        setCart({
          items: updatedItems,
          total_amount: updatedItems.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0)
        });
      } else {
        const updatedItems = [...cart.items, newItem];
        setCart({
          items: updatedItems,
          total_amount: updatedItems.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0)
        });
      }

      alert('Item added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  const handleBackToMarket = () => {
    setSelectedSupplier(null);
    setProducts([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading the marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-green-700">🏪 MicroMarket</h1>
              {selectedSupplier && (
                <button
                  onClick={handleBackToMarket}
                  className="ml-6 text-blue-600 hover:text-blue-800 flex items-center"
                >
                  ← Back to Market
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Welcome, {user.name}</span>
                  <div className="bg-green-100 px-2 py-1 rounded-full text-xs">
                    {cart.items.length} items (${cart.total_amount.toFixed(2)})
                  </div>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 px-3 py-1 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedSupplier ? (
          <div>
            {/* Market Overview */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Welcome to the Virtual Wholesale Market
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Browse digital stalls from local suppliers and farmers. Find fresh produce, 
                compare prices, and order in bulk for your street food business.
              </p>
            </div>

            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  onViewStall={handleViewStall}
                />
              ))}
            </div>
            
            {suppliers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No suppliers available at the moment.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Supplier Stall View */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <img
                  src={selectedSupplier.image_url}
                  alt={selectedSupplier.stall_name}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedSupplier.stall_name}</h2>
                  <p className="text-gray-600">{selectedSupplier.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-yellow-600">⭐ {selectedSupplier.rating} Rating</span>
                    <span className="text-sm text-blue-600">🚚 {selectedSupplier.delivery_rating} Delivery</span>
                    <span className="text-sm text-gray-600">📞 {selectedSupplier.contact_phone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
            
            {products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No products available from this supplier.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <VirtualMarket />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
              🏪 MicroMarket
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The Digital Wholesale Marketplace connecting street food vendors with fresh produce suppliers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setIsLogin(false);
                  setAuthModalOpen(true);
                }}
                className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Start Selling (Vendor)
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setAuthModalOpen(true);
                }}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Join as Supplier
              </button>
              <button
                onClick={() => {
                  setIsLogin(true);
                  setAuthModalOpen(true);
                }}
                className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:border-gray-400 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-lg overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1532079563951-0c8a7dacddb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwxfHxtYXJrZXRwbGFjZXxlbnwwfHx8fDE3NTM1Mzg0NDd8MA&ixlib=rb-4.1.0&q=85"
              alt="Virtual Marketplace"
              className="w-full h-64 md:h-96 object-cover"
            />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Why Choose MicroMarket?</h2>
          <p className="text-lg text-gray-600">Everything you need to run your street food business efficiently</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗺️</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Virtual Market Map</h3>
            <p className="text-gray-600">Navigate through digital stalls like walking in a real bazaar. Smooth animations and intuitive browsing.</p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Live Pricing</h3>
            <p className="text-gray-600">Real-time price updates, bulk discounts, and transparent pricing from multiple suppliers.</p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛒</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Multi-Supplier Cart</h3>
            <p className="text-gray-600">Order from multiple suppliers in one cart. Efficient bulk purchasing for your business needs.</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Business?</h2>
          <p className="text-xl text-green-100 mb-8">Join thousands of vendors and suppliers already using MicroMarket</p>
          <button
            onClick={() => {
              setIsLogin(false);
              setAuthModalOpen(true);
            }}
            className="bg-white text-green-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Get Started Today
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        isLogin={isLogin}
        setIsLogin={setIsLogin}
      />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Home />
      </div>
    </AuthProvider>
  );
}

export default App;