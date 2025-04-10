from database.schema import initialize_database
from config import LICENSE_DB_PATH

if __name__ == "__main__":
    print(f"正在初始化许可证数据库: {LICENSE_DB_PATH}")
    success = initialize_database(LICENSE_DB_PATH)
    if success:
        print("✅ 数据库初始化成功")
    else:
        print("❌ 数据库初始化失败")
