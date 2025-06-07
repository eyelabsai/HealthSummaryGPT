import os
import shutil
import sys

def clear_uploads_directory():
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    
    # Check if directory exists
    if not os.path.exists(uploads_dir):
        print(f"Error: Uploads directory not found at {uploads_dir}")
        return False
    
    # List all files in the directory
    files = os.listdir(uploads_dir)
    if not files:
        print("Uploads directory is already empty.")
        return True
    
    # Show files that will be deleted
    print(f"\nFound {len(files)} files in uploads directory:")
    for file in files:
        print(f"- {file}")
    
    # Ask for confirmation
    confirmation = input("\nAre you sure you want to delete all these files? (yes/no): ").lower()
    if confirmation != 'yes':
        print("Operation cancelled.")
        return False
    
    try:
        # Remove all files in the directory
        for file in files:
            file_path = os.path.join(uploads_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
        
        print(f"\nSuccessfully cleared {len(files)} files from uploads directory.")
        return True
    
    except Exception as e:
        print(f"Error occurred while clearing files: {str(e)}")
        return False

if __name__ == "__main__":
    print("Uploads Directory Cleanup Script")
    print("===============================")
    success = clear_uploads_directory()
    sys.exit(0 if success else 1) 