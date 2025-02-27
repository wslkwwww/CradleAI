import json
import struct
import base64
from typing import List, Tuple
import uuid
import os

def read_png_chunks(file_path: str) -> List[Tuple[str, bytes]]:
    chunks = []
    with open(file_path, 'rb') as f:
        # 验证PNG签名
        png_signature = f.read(8)
        if png_signature != b'\x89PNG\r\n\x1a\n':
            raise ValueError("不是有效的PNG文件")
            
        while True:
            try:
                # 读取chunk长度
                length_bytes = f.read(4)
                if not length_bytes:
                    break
                length = struct.unpack('>I', length_bytes)[0]
                
                # 读取chunk类型
                chunk_type = f.read(4).decode('ascii')
                
                # 读取chunk数据
                data = f.read(length)
                
                # 读取CRC（校验）
                crc = f.read(4)
                
                chunks.append((chunk_type, data))
                
                if chunk_type == 'IEND':
                    break
                    
            except Exception as e:
                print(f"读取chunk时出错: {e}")
                break
    
    return chunks
def read_json_from_png(png_file_path: str):
    try:
        chunks = read_png_chunks(png_file_path)
        print(f"找到 {len(chunks)} 个chunks")
        
        found_data = {}
        for chunk_type, data in chunks:
            if chunk_type == 'tEXt':
                try:
                    parts = data.split(b'\x00', 1)
                    if len(parts) == 2:
                        keyword = parts[0].decode('utf-8')
                        text = parts[1]
                        print(f"\n找到文本块，关键字: {keyword}")
                        print(f"数据长度: {len(text)} 字节")
                        
                        try:
                            decoded_bytes = base64.b64decode(text)
                            decoded_text = decoded_bytes.decode('utf-8')
                            json_data = json.loads(decoded_text)
                            print(f"成功解析 {keyword} 的JSON数据")
                            found_data[keyword] = json_data
                        except Exception as e:
                            print(f"处理 {keyword} 数据时出错: {str(e)}")
                            
                except Exception as e:
                    print(f"处理文本块时出错: {str(e)}")
                    
        return found_data if found_data else None
        
    except Exception as e:
        print(f"读取出错: {str(e)}")
        return None

def save_json_with_random_id(json_data: dict, base_dir: str = "/root/conversations"):
    """Save JSON data with a random conversation ID as filename"""
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    
    conversation_id = str(uuid.uuid4())
    file_path = os.path.join(base_dir, f"{conversation_id}.json")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    return conversation_id, file_path

if __name__ == "__main__":
    png_file = "output.png"
    json_data = read_json_from_png(png_file)
    if json_data:
        for key, data in json_data.items():
            print(f"\n{key} 数据:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
            
            # Save each JSON data with a random conversation ID
            try:
                conv_id, saved_path = save_json_with_random_id({key: data})
                print(f"\n已保存到文件: {saved_path}")
                print(f"会话ID: {conv_id}")
            except Exception as e:
                print(f"保存JSON数据时出错: {str(e)}")