import os
import zipfile

def zip_project(output_filename):
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Exclude the zip file itself and the script
            if output_filename in files:
                files.remove(output_filename)
            if 'create_zip.py' in files:
                files.remove('create_zip.py')
            if '.git' in dirs:
                dirs.remove('.git')  # Exclude .git directory
            for file in files:
                zipf.write(os.path.join(root, file))

if __name__ == '__main__':
    zip_project('project.zip')
