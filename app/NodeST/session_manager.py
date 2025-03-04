import os
import json
import fcntl
from typing import Dict, Optional, Any, List
from chat_manager import ChatManager
from character_utils import build_r_framework, extract_d_entries

class SessionManager:
    def __init__(self, base_dir: str = "/root/playground/chat_data"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)
        
    def _get_character_dir(self, conversation_id: str) -> str:
        """获取角色专属目录"""
        char_dir = os.path.join(self.base_dir, conversation_id)
        os.makedirs(char_dir, exist_ok=True)
        return char_dir
        
    def _get_session_file(self, conversation_id: str) -> str:
        """获取会话文件路径"""
        char_dir = self._get_character_dir(conversation_id)
        return os.path.join(char_dir, "chat_history.json")
        
    def _save_character_json(self, conversation_id: str, json_data: Dict, file_name: str) -> bool:
        """保存角色相关的JSON文件"""
        char_dir = self._get_character_dir(conversation_id)
        file_path = os.path.join(char_dir, file_name)
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存{file_name}失败: {e}")
            return False

    def _load_character_json(self, conversation_id: str, file_name: str) -> Optional[Dict]:
        """加载角色相关的JSON文件"""
        char_dir = self._get_character_dir(conversation_id)
        file_path = os.path.join(char_dir, file_name)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"找不到文件: {file_path}")
            return None
        
    def _acquire_lock(self, file_path: str):
        """获取文件锁"""
        file_obj = open(file_path, 'a+')
        fcntl.flock(file_obj, fcntl.LOCK_EX)
        return file_obj
        
    def _release_lock(self, file_obj):
        """释放文件锁"""
        fcntl.flock(file_obj, fcntl.LOCK_UN)
        file_obj.close()

    def create_new_character(self, conversation_id: str, 
                           role_card: Dict, world_book: Dict, 
                           preset: Dict, author_note: Dict = None,
                           api_key: str = None) -> bool:  # 确保 api_key 是必需参数
        """创建新角色，保存所有相关文件"""
        try:
            # 保存角色相关的JSON文件
            json_files = {
                "role_card.json": role_card,
                "world_book.json": world_book,
                "preset.json": preset
            }
            if author_note:
                json_files["author_note.json"] = author_note

            for file_name, data in json_files.items():
                if not self._save_character_json(conversation_id, data, file_name):
                    return False

            if not all([role_card, world_book, preset]):
                print("Error: Missing required data")
                return False
                
            # 构建初始请求体
            r_framework, _ = build_r_framework(preset, role_card)
            d_entries = extract_d_entries(preset, world_book, author_note)
            
            # 修改：需要在 create_new_character 函数签名中添加 api_key 参数
            # 并修改这里的代码，删除 load_api_key 的调用
            chat_manager = ChatManager(api_key)  # 而不是使用 dummy_key
            
            # 1. 先进行内容清理用于匹配检查
            char_name = author_note.get("charname", "") if author_note else ""
            user_name = author_note.get("username", "") if author_note else ""
            cleaned_contents = chat_manager._clean_contents_for_gemini(
                r_framework,
                char_name=char_name,
                user_name=user_name,
                role_card=role_card
            )
            
            # 2. 过滤D类条目
            filtered_d_entries = chat_manager._filter_d_entries_by_keys(d_entries, cleaned_contents)
            
            contents = []
            chat_history = None
            
            # 按R框架顺序添加内容
            for item in r_framework:
                if item.get("name") == "Chat History":
                    chat_history = {
                        "name": "Chat History",
                        "role": "system",
                        "parts": [],
                        "identifier": "chatHistory"
                    }

                    # 添加开场白作为第一条消息，并加上标记
                    if role_card and role_card.get("first_mes"):
                        chat_history["parts"].append({
                            "role": "model",
                            "parts": [{"text": role_card["first_mes"]}],
                            "is_first_mes": True  # 添加标记以区分开场白
                        })
                        print("已添加开场白作为聊天历史的第一条消息")

                    # 2. 然后插入D类条目
                    chat_history = self._insert_d_entries_to_initial_history(
                        chat_history,
                        filtered_d_entries  # 使用过滤后的D类条目
                    )
                    contents.append(chat_history)
                else:
                    contents.append(item)
            
            # 保存到文件
            file_path = self._get_session_file(conversation_id)
            file_obj = self._acquire_lock(file_path)
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(contents, f, ensure_ascii=False, indent=2)
                return True
            finally:
                self._release_lock(file_obj)
                
        except Exception as e:
            print(f"创建角色失败: {e}")
            return False

    def _insert_d_entries_to_initial_history(self, chatHistoryEntity: Dict, d_entries: List[Dict]) -> Dict:
        """在初始化时插入D类条目到聊天历史中，保留已有消息"""
        # 保存现有消息
        existing_messages = chatHistoryEntity.get('parts', [])
        new_messages = []
        
        # 首先分类所有D类条目
        author_note = next((d for d in d_entries if d.get('is_author_note')), None)
        position_2_entries = [d for d in d_entries if d.get('position') == 2]
        position_3_entries = [d for d in d_entries if d.get('position') == 3]
        depth_based_entries = [d for d in d_entries if d.get('position') == 4 or d.get('position') is None]

        # 首先添加所有已有消息（包括开场白）
        for msg in existing_messages:
            if msg.get('is_first_mes'):  # 如果是开场白，添加到最前面
                new_messages.insert(0, msg)
            elif not msg.get('is_d_entry'):  # 保留其他非D类消息
                new_messages.append(msg)

        print(f"现有消息数: {len(existing_messages)}")
        print(f"其中开场白消息: {[msg for msg in existing_messages if msg.get('is_first_mes')]}")
        
        # 按顺序插入各类条目
        # 1. 先插入基于深度>0的条目
        for d_entry in sorted(depth_based_entries, 
                            key=lambda x: (-x.get('injection_depth', 0), x.get('insertion_order', 0))):
            if d_entry.get('injection_depth', 0) > 0:
                new_messages.append(self._create_d_entry_message(d_entry))

        # 2. 插入作者注释相关条目
        if author_note:
            # position=2的条目（作者注释之前）
            for entry in sorted(position_2_entries, key=lambda x: x.get('insertion_order', 0)):
                new_messages.append(self._create_d_entry_message(entry))
                
            # 作者注释本身
            new_messages.append(self._create_d_entry_message(author_note))
            
            # position=3的条目（作者注释之后）
            for entry in sorted(position_3_entries, key=lambda x: x.get('insertion_order', 0)):
                new_messages.append(self._create_d_entry_message(entry))

        # 3. 最后插入基于深度=0的条目
        for d_entry in sorted(depth_based_entries, 
                            key=lambda x: (-x.get('injection_depth', 0), x.get('insertion_order', 0))):
            if d_entry.get('injection_depth', 0) == 0:
                new_messages.append(self._create_d_entry_message(d_entry))

        chatHistoryEntity['parts'] = new_messages
        return chatHistoryEntity

    def _create_d_entry_message(self, d_entry: Dict) -> Dict:
        """创建D类条目消息，确保保留所有必要的属性"""
        message = {
            "role": d_entry.get("role", "user"),
            "parts": [{"text": d_entry.get('content', '')}],
            "is_d_entry": True
        }
        
        # 保留所有原始属性
        for key, value in d_entry.items():
            if key not in ["role", "parts", "is_d_entry", "content"]:
                message[key] = value
                
        return message

    def update_character(self, conversation_id: str,
                        role_card: Dict, world_book: Dict,
                        preset: Dict, api_key: str) -> bool:  # 添加 api_key 参数
        """更新角色设定"""
        if not os.path.exists(self._get_session_file(conversation_id)):
            return False
            
        # 加载现有的聊天历史以便进行D类条目过滤
        try:
            chat_history = self._load_character_json(conversation_id, "chat_history.json")
            # 使用传入的 api_key 创建 chat_manager
            chat_manager = ChatManager(api_key)
            
            # 构建初始请求体
            r_framework, _ = build_r_framework(preset, role_card)
            d_entries = extract_d_entries(preset, world_book)
            
            # 清理现有内容用于匹配检查
            cleaned_contents = chat_manager._clean_contents_for_gemini(
                chat_history if chat_history else r_framework,
                role_card=role_card
            )
            
            # 过滤D类条目
            filtered_d_entries = chat_manager._filter_d_entries_by_keys(d_entries, cleaned_contents)
            
            # 使用过滤后的D类条目更新角色
            return self.create_new_character(
                conversation_id, 
                role_card, 
                world_book, 
                preset,
                filtered_d_entries  # 传递过滤后的D类条目
            )
            
        except Exception as e:
            print(f"更新角色失败: {e}")
            return False

    def continue_chat(self, conversation_id: str, user_message: str,
                     chat_manager: ChatManager, d_entries: List[Dict]) -> Optional[str]:
        try:
            # 1. 确保角色目录存在
            char_dir = self._get_character_dir(conversation_id)
            if not os.path.exists(char_dir):
                print(f"角色目录不存在: {char_dir}")
                return None

            # 2. 加载角色配置文件
            role_card = self._load_character_json(conversation_id, "role_card.json")
            world_book = self._load_character_json(conversation_id, "world_book.json")
            preset = self._load_character_json(conversation_id, "preset.json")
            author_note = self._load_character_json(conversation_id, "author_note.json")

            # 3. 验证必要文件
            if not all([role_card, world_book, preset]):
                print(f"缺少必要的角色设定文件: {conversation_id}")
                for name, data in {
                    "role_card.json": role_card,
                    "world_book.json": world_book,
                    "preset.json": preset
                }.items():
                    if not data:
                        print(f"Missing: {name}")
                return None

            # 4. 重新提取D类条目
            d_entries = extract_d_entries(preset, world_book, author_note)

            # 5. 处理聊天历史
            chat_history_path = self._get_session_file(conversation_id)
            is_first_chat = not os.path.exists(chat_history_path)  # 添加首次对话标记
            
            if is_first_chat:
                # 如果是首次对话，创建新的聊天历史
                print("首次对话，准备添加开场白...")
                contents = []
                r_framework, _ = build_r_framework(preset, role_card)
                
                # 先进行内容清理用于匹配检查
                char_name = author_note.get("charname", "") if author_note else ""
                user_name = author_note.get("username", "") if author_note else ""
                cleaned_contents = chat_manager._clean_contents_for_gemini(
                    r_framework,
                    user_message=user_message,
                    char_name=char_name,
                    user_name=user_name,
                    role_card=role_card
                )
                
                # 过滤D类条目
                filtered_d_entries = chat_manager._filter_d_entries_by_keys(d_entries, cleaned_contents)
                
                # 处理开场白和对话
                response = chat_manager.process_chat(
                    user_message=user_message,
                    r_framework=r_framework,
                    chatHistoryEntity={"name": "Chat History", "role": "system", "parts": []},
                    d_entries=filtered_d_entries,
                    session_id=conversation_id,
                    author_note=author_note,
                    role_card=role_card  # 确保传入role_card
                )
                
                return response

            # 如果不是首次对话，继续原有的处理逻辑
            file_obj = self._acquire_lock(chat_history_path)
            try:
                with open(chat_history_path, 'r', encoding='utf-8') as f:
                    contents = json.load(f)

                # 6. 重建R框架
                r_framework, _ = build_r_framework(preset, role_card)
                
                # 7. 更新聊天历史
                chat_history_index = next((i for i, item in enumerate(contents) 
                                  if isinstance(item, dict) and item.get("name") == "Chat History"), None)
                
                if chat_history_index is None:
                    print("聊天历史部分未找到")
                    return None

                current_history = contents[chat_history_index]
                
                # 修改：保留开场白和非D类消息
                preserved_messages = [
                    msg for msg in current_history['parts']
                    if msg.get('is_first_mes') or not msg.get('is_d_entry')
                ]
                
                print("保留的消息数:", len(preserved_messages))
                print("其中开场白:", [msg for msg in preserved_messages if msg.get('is_first_mes')])
                
                # 更新当前历史，保留开场白和其他非D类消息
                current_history['parts'] = preserved_messages
                
                # 添加新的用户消息
                current_history['parts'].append({
                    "role": "user",
                    "parts": [{"text": user_message}]
                })
                # 重新插入D类条目
                contents[chat_history_index] = self._insert_d_entries_to_initial_history(
                    current_history,
                    d_entries
                )
                
                # 10. 处理对话
                response = chat_manager.process_chat(
                    user_message=user_message,
                    r_framework=r_framework,
                    chatHistoryEntity=contents[chat_history_index],
                    d_entries=d_entries,
                    session_id=conversation_id,
                    author_note=author_note,
                    role_card=role_card
                )

                # 11. 保存更新后的内容
                with open(chat_history_path, 'w', encoding='utf-8') as f:
                    json.dump(contents, f, ensure_ascii=False, indent=2)

                return response

            finally:
                self._release_lock(file_obj)

        except Exception as e:
            print(f"对话处理失败: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

