from chat_manager import ChatManager
from typing import Literal, Dict, Optional
from session_manager import SessionManager
from character_utils import build_r_framework, extract_d_entries, load_json
import json

def process_request(
    user_message: str,
    conversation_id: str,
    status: Literal["新建角色", "同一角色继续对话", "更新人设"],
    api_key: str,  # 添加api_key参数
    role_card_json: Dict = None,
    world_book_json: Dict = None,
    preset_json: Dict = None,
    author_note_json: Dict = None  # 添加author_note_json参数
) -> Optional[str]:
    """处理会话请求"""
    try:
        session_manager = SessionManager()
        
        # 根据状态执行不同操作
        if status == "新建角色":
            if not all([role_card_json, world_book_json, preset_json]):
                raise ValueError("新建角色需要提供完整的角色信息")
            d_entries = extract_d_entries(preset_json, world_book_json, author_note_json)  # 传入author_note
            return session_manager.create_new_character(
                conversation_id, 
                role_card_json, 
                world_book_json, 
                preset_json,
                author_note_json,
                api_key  # 添加 api_key 参数
            )
            
        elif status == "更新人设":
            if not all([role_card_json, world_book_json, preset_json]):
                raise ValueError("更新人设需要提供完整的角色信息")
            return session_manager.update_character(
                conversation_id, 
                role_card_json, 
                world_book_json, 
                preset_json,
                api_key  # 添加 api_key
            )
            
        elif status == "同一角色继续对话":
            if not user_message:
                raise ValueError("继续对话需要提供用户消息")
            # 直接使用传入的api_key
            chat_manager = ChatManager(api_key)
            # 重新提取D类条目
            d_entries = extract_d_entries(preset_json, world_book_json, author_note_json)  # 传入author_note
            return session_manager.continue_chat(
                conversation_id, user_message, chat_manager, d_entries
            )
            
    except Exception as e:
        print(f"Error processing request: {e}")
        return None

def main():
    try:
        api_key = "your-api-key-here"  # 在实际使用时替换为真实的API key
        if not api_key:
            print("无法继续：缺少有效的API key")
            return
        
        # 使用示例JSON字符串（实际使用时替换为真实的JSON字符串）
        preset_json = json.loads('''{"prompts": [], "prompt_order": []}''')
        role_card_json = json.loads('''{"name": "test_character", "first_mes": "Hello!"}''')
        world_book_json = json.loads('''{"entries": {}}''')
        
        try:
            author_note_json = json.loads('''{"charname": "TestChar", "username": "TestUser"}''')
        except json.JSONDecodeError:
            author_note_json = None

        # 构建基础框架
        r_framework, chatHistoryEntity = build_r_framework(preset_json, role_card_json)
        d_entries = extract_d_entries(preset_json, world_book_json, author_note_json)
        print("\n检查D类条目是否为空:", bool(d_entries))
        print("D类条目数量:", len(d_entries))

        # 使用新创建的chat_manager
        chat_manager = ChatManager(api_key)
        # 模拟对话
        user_message = "我喜欢saber，你知道她吗。"
        response = chat_manager.process_chat(
            user_message,
            r_framework,
            chatHistoryEntity,
            d_entries
        )
        print(f"AI Response: {response}")
        
        # 测试新建角色
        result = process_request(
            user_message="",
            conversation_id="test_char_001",
            status="新建角色",
            api_key=api_key,  # 传入api_key
            role_card_json=role_card_json,
            world_book_json=world_book_json,
            preset_json=preset_json
        )
        print(f"创建角色结果: {result}")
        
        # 测试继续对话
        response = process_request(
            user_message="你好！",
            conversation_id="test_char_001",
            status="同一角色继续对话",
            api_key=api_key,  # 传入api_key
            role_card_json=role_card_json,
            world_book_json=world_book_json,
            preset_json=preset_json
        )
        print(f"对话响应: {response}")
        
    except Exception as e:
        print(f"Error: {e}")
        return

if __name__ == "__main__":
    main()
