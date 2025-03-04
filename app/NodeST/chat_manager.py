import json
import os
from typing import Dict, List, Any
from gemini_adapter import GeminiAdapter

class ChatManager:
    def __init__(self, api_key: str, save_dir: str = "/root/playground/chat_data"):
        self.adapter = GeminiAdapter(api_key)
        self.save_dir = save_dir
        self.current_contents = None
        os.makedirs(save_dir, exist_ok=True)
    
    @staticmethod
    def insert_d_entries(r_framework, chatHistoryEntity, d_entries, user_message):
        """D类条目插入函数"""
        # ...existing code from ST test.py insert_d_entries function...

    @staticmethod
    def update_chat_history(chatHistoryEntity, user_message, ai_response, d_entries):
        """更新聊天历史，添加用户消息和AI响应，避免重复"""
        if not isinstance(chatHistoryEntity.get('parts', []), list):
            chatHistoryEntity['parts'] = []
        
        # 获取已有的消息，确保它是一个列表
        current_messages = chatHistoryEntity.get('parts', [])
        if not isinstance(current_messages, list):
            current_messages = []

        # 检查是否已存在相同的消息
        def message_exists(message, messages):
            """检查消息是否已存在"""
            message_text = message.get('parts', [{}])[0].get('text', '')
            message_role = message.get('role', '')
            for msg in messages:
                if (msg.get('parts', [{}])[0].get('text', '') == message_text and 
                    msg.get('role', '') == message_role):
                    return True
            return False

        # 添加用户消息（如果不存在）
        user_message_obj = {
            "role": "user",
            "parts": [{"text": user_message}]
        }
        if not message_exists(user_message_obj, current_messages):
            current_messages.append(user_message_obj)

        # 如果有AI响应，添加到历史记录（如果不存在）
        if ai_response:
            ai_message_obj = {
                "role": "model",
                "parts": [{"text": ai_response}]
            }
            if not message_exists(ai_message_obj, current_messages):
                current_messages.append(ai_message_obj)

        # 更新chatHistoryEntity
        chatHistoryEntity.update({
            "name": "Chat History",
            "role": "system",
            "parts": current_messages,
            "identifier": "chatHistory"
        })

        return chatHistoryEntity

    def save_contents(self, contents: List[Dict[str, Any]], session_id: str = "default"):
        """保存当前的请求体内容到本地"""
        # 在保存前清理 None 值
        cleaned_contents = [item for item in contents if item is not None]
        
        file_path = os.path.join(self.save_dir, f"{session_id}_contents.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_contents, f, ensure_ascii=False, indent=2)
        
        # 打印保存的内容以验证
        print("\n=== 保存到文件的完整内容 ===")
        print(json.dumps(cleaned_contents, indent=2, ensure_ascii=False))
        print("===========================\n")
        
        self.current_contents = cleaned_contents

    def load_contents(self, session_id: str = "default") -> List[Dict[str, Any]]:
        """从本地加载请求体内容"""
        file_path = os.path.join(self.save_dir, f"{session_id}_contents.json")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                self.current_contents = json.load(f)
                return self.current_contents
        except FileNotFoundError:
            return None

    def _apply_regex_scripts(self, text: str, regex_scripts: List[Dict]) -> str:
        """应用正则表达式替换规则，失败时返回原文本"""
        if not isinstance(text, str):
            return text
            
        try:
            for script in regex_scripts:
                try:
                    # 提取正则表达式和替换字符串
                    find_regex = script.get('findRegex', '')
                    replace_string = script.get('replaceString', '')
                    
                    if not find_regex or not replace_string:
                        continue
                        
                    # 去除正则表达式字符串的首尾斜杠
                    if find_regex.startswith('/') and find_regex.endswith('/'):
                        find_regex = find_regex[1:-1]
                    
                    # 获取正则表达式的标志
                    flags = 0
                    if 'g' in script.get('flags', ''):
                        flags |= re.GLOBAL
                    if 'm' in script.get('flags', ''):
                        flags |= re.MULTILINE
                    
                    # 执行替换
                    import re
                    text = re.sub(find_regex, replace_string, text, flags=flags)
                    
                except Exception as e:
                    print(f"正则表达式处理警告 - 脚本 {script.get('scriptName', 'unknown')}: {str(e)}")
                    print(f"正则表达式: {find_regex}")
                    print(f"替换字符串: {replace_string}")
                    print("继续处理下一个正则表达式...")
                    continue
                    
            return text
            
        except Exception as e:
            print(f"正则替换过程中发生错误: {str(e)}")
            print("返回原始文本...")
            return text

    def _clean_contents_for_gemini(self, contents: List[Dict], 
                                 user_message: str = "", 
                                 char_name: str = "", 
                                 user_name: str = "",
                                 role_card: Dict = None) -> List[Dict]:
        """清理contents，确保system角色转换为user"""
        cleaned_contents = []
        
        def replace_placeholders(text: str) -> str:
            """替换所有占位符和应用正则替换"""
            if not isinstance(text, str):
                return text
                
            try:
                # 基础变量替换
                text = (text.replace("{{lastMessage}}", user_message)
                          .replace("{{char}}", char_name)
                          .replace("{{user}}", user_name))
                
                # 应用正则替换规则
                if role_card and 'extensions' in role_card.get('data', {}):
                    regex_scripts = role_card['data']['extensions'].get('regex_scripts', [])
                    # 即使正则替换失败也会返回原文本或已部分处理的文本
                    text = self._apply_regex_scripts(text, regex_scripts)
                    
                return text
            except Exception as e:
                print(f"文本处理警告: {str(e)}")
                print("返回原始文本...")
                return text
        
        # 遍历内容并应用替换
        for item in contents:
            if not isinstance(item, dict):
                continue

            if item.get("name") == "Chat History":
                history_messages = item.get("parts", [])
                for msg in history_messages:
                    if isinstance(msg, dict) and msg.get("parts"):
                        msg_parts = msg["parts"]
                        for part in msg_parts:
                            if isinstance(part, dict) and "text" in part:
                                part["text"] = replace_placeholders(part["text"])
                        
                        # 关键修改：统一将 system 角色转换为 user
                        cleaned_msg = {
                            "role": "user" if msg.get("role") in ["user", "system"] else "model",
                            "parts": msg_parts
                        }
                        cleaned_contents.append(cleaned_msg)
            else:
                parts = item.get("parts", [])
                if parts:
                    new_parts = []
                    for part in parts:
                        if isinstance(part, dict) and "text" in part:
                            new_part = {
                                "text": replace_placeholders(part["text"])
                            }
                            new_parts.append(new_part)
                        else:
                            new_parts.append(part)
                    
                    # 关键修改：统一将 system 角色转换为 user
                    cleaned_item = {
                        "role": "user" if item.get("role") in ["user", "system"] else "model",
                        "parts": new_parts
                    }
                    cleaned_contents.append(cleaned_item)

        return cleaned_contents

    def _insert_d_entries_to_history(self, chatHistoryEntity: Dict, d_entries: List[Dict], 
                                   user_message: str, has_first_mes: bool = False) -> Dict:
        """在发送给Gemini前，将D类条目插入到聊天历史中"""
        print("\n=== D类条目插入调试 ===")
        print(f"用户消息: {user_message}")
        print(f"D类条目数量: {len(d_entries)}")
        
        # 首先分类所有D类条目
        author_note = next((d for d in d_entries if d.get('is_author_note')), None)
        position_2_entries = [d for d in d_entries if d.get('position') == 2]
        position_3_entries = [d for d in d_entries if d.get('position') == 3]
        
        # 修改：添加对injection_position=1条目的处理
        injection_pos_1_entries = [
            d for d in d_entries 
            if (d.get('injection_position') == 1 or d.get('position') == 4 or d.get('position') is None)
        ]

        # 按深度和顺序排序需要基于深度插入的条目
        sorted_depth_entries = sorted(
            injection_pos_1_entries,
            key=lambda x: (-x.get('injection_depth', 0), x.get('insertion_order', 0))
        )

        print("\nD类条目分类统计:")
        print(f"- injection_position=1条目数量: {len([d for d in d_entries if d.get('injection_position') == 1])}")
        print(f"- position=2条目数量: {len(position_2_entries)}")
        print(f"- position=3条目数量: {len(position_3_entries)}")
        print(f"- 基于深度的条目数量: {len(sorted_depth_entries)}")

        # 构建新的消息列表
        new_messages = []
        current_messages = chatHistoryEntity.get('parts', [])
        first_mes_index = 0 if has_first_mes else None

        # 保留开场白消息
        for msg in current_messages:
            if msg.get('is_first_mes'):
                new_messages.append(msg)
                break

        # 修改：重新组织条目插入逻辑
        # 1. 按深度和位置分类所有条目
        depth_gt_0_entries = []  # 深度>0的条目
        depth_0_entries = []     # 深度=0的条目
        
        for entry in sorted_depth_entries:
            depth = entry.get('injection_depth', 0)
            is_injection_pos_1 = entry.get('injection_position') == 1
            
            # injection_position=1且depth=0的条目视为普通的depth=0条目
            if depth > 0:
                depth_gt_0_entries.append(entry)
            else:  # depth=0的条目，包括injection_position=1的depth=0条目
                depth_0_entries.append(entry)

        # 2. 先插入开场白（如果有）
        new_messages = []
        if has_first_mes:
            first_mes = next((msg for msg in current_messages if msg.get('is_first_mes')), None)
            if first_mes:
                new_messages.append(first_mes)

        # 3. 插入深度>0的条目
        for entry in depth_gt_0_entries:
            new_messages.append(self._create_d_entry_message(entry))

        # 4. 添加其他消息和depth=0的条目
        for msg in current_messages:
            if not msg.get('is_first_mes') and not msg.get('is_d_entry'):
                new_messages.append(msg)
                
                # 在用户消息后插入所有depth=0的条目
                if msg.get('role') == 'user' and msg.get('parts', [{}])[0].get('text') == user_message:
                    for d_entry in depth_0_entries:
                        new_messages.append(self._create_d_entry_message(d_entry))

        # 更新chat history
        chatHistoryEntity['parts'] = new_messages

        # 打印最终消息列表用于调试
        print("\n最终消息列表:")
        for msg in new_messages:
            print(f"- Role: {msg.get('role')}, Is_D_Entry: {msg.get('is_d_entry', False)}, Name: {msg.get('name', 'N/A')}")
            if msg.get('is_d_entry'):
                print(f"  Depth: {msg.get('injection_depth')}, Injection Position: {msg.get('injection_position')}")

        return chatHistoryEntity

    def _create_d_entry_message(self, d_entry: Dict) -> Dict:
        """创建D类条目消息，保留constant、key等关键参数"""
        return {
            "role": d_entry.get("role", "user"),
            "parts": [{"text": d_entry.get('content', '')}],
            "is_d_entry": True,
            "constant": d_entry.get('constant'),
            "key": d_entry.get('key', []),
            "name": d_entry.get('name'),
            "injection_depth": d_entry.get('injection_depth', 0)
        }

    def _check_keys_in_contents(self, key: List[str], cleaned_contents: List[Dict]) -> bool:
        """检查key是否出现在清理后的内容中"""
        if not key:
            return True
            
        # 提取所有文本内容
        all_text = ""
        for content in cleaned_contents:
            for part in content.get("parts", []):
                if isinstance(part, dict):
                    all_text += part.get("text", "") + " "
                    
        all_text = all_text.lower()  # 转换为小写以进行不区分大小写的匹配
        
        # 检查是否key在文本中出现
        return any(k.lower() in all_text for k in key)

    def _filter_d_entries_by_keys(self, d_entries: List[Dict], cleaned_contents: List[Dict]) -> List[Dict]:
        """根据key过滤D类条目"""
        filtered_entries = []
        
        for entry in d_entries:
            # 修改判断逻辑：必须显式检查 constant 的值
            if entry.get('constant') is True:  # 只有明确设置为 True 时才直接添加
                filtered_entries.append(entry)
                print(f"D类条目 '{entry.get('name')}' constant=True，直接添加")
                continue
                
            # 检查key是否在内容中出现
            key = entry.get('key', [])
            if self._check_keys_in_contents(key, cleaned_contents):
                filtered_entries.append(entry)
                print(f"D类条目 '{entry.get('name')}' 的key {key} 匹配成功，将被插入")
            else:
                print(f"D类条目 '{entry.get('name')}' 的key {key} 未匹配，将被跳过")
                
        return filtered_entries

    def process_chat(self, user_message: str, r_framework: List[Dict], 
                    chatHistoryEntity: Dict, d_entries: List[Dict], 
                    session_id: str = "default", author_note: Dict = None,
                    role_card: Dict = None) -> str:
        """处理对话，支持first_mes作为开场白"""
        contents = self.load_contents(session_id)
        chat_history_index = None

        # 1. 先进行内容清理
        char_name = author_note.get("charname", "") if author_note else ""
        user_name = author_note.get("username", "") if author_note else ""
        
        # 2. 对当前内容进行清理，用于keys匹配检查
        current_cleaned_contents = self._clean_contents_for_gemini(
            contents if contents else r_framework,
            user_message=user_message,
            char_name=char_name,
            user_name=user_name,
            role_card=role_card
        )
        
        # 3. 根据清理后的内容过滤D类条目
        filtered_d_entries = self._filter_d_entries_by_keys(d_entries, current_cleaned_contents)
        print(f"\n过滤后的D类条目数量: {len(filtered_d_entries)}")
        
        if contents is None:  # 首次对话
            contents = []
            for i, item in enumerate(r_framework):
                if item.get("name") == "Chat History":
                    chat_history = {
                        "name": "Chat History",
                        "role": "system",
                        "parts": [],
                        "identifier": "chatHistory"
                    }
                    
                    # 添加开场白作为第一条消息
                    if role_card and role_card.get("first_mes"):
                        chat_history["parts"].append({
                            "role": "model",
                            "parts": [{"text": role_card["first_mes"]}],
                            "is_first_mes": True
                        })
                        print("已添加开场白作为聊天历史的第一条消息")
                    
                    # 添加用户消息
                    chat_history["parts"].append({
                        "role": "user",
                        "parts": [{"text": user_message}]
                    })
                    
                    # 插入D类条目
                    chat_history = self._insert_d_entries_to_history(
                        chat_history,
                        filtered_d_entries,
                        user_message,
                        has_first_mes=bool(role_card and role_card.get("first_mes"))  # 添加标记
                    )
                    
                    contents.append(chat_history)
                    chat_history_index = i
                else:
                    contents.append(item)
        
        else:  # 非首次对话
            chat_history_index = next((i for i, item in enumerate(contents) 
                                    if isinstance(item, dict) and item.get("name") == "Chat History"), None)
            
            if chat_history_index is not None:
                current_history = contents[chat_history_index]
                current_history['parts'] = [msg for msg in current_history['parts'] 
                                          if not msg.get('is_d_entry', False)]
                
                current_history['parts'].append({
                    "role": "user",
                    "parts": [{"text": user_message}]
                })
                
                # 使用过滤后的D类条目
                contents[chat_history_index] = self._insert_d_entries_to_history(
                    current_history,
                    filtered_d_entries,  # 使用过滤后的D类条目
                    user_message
                )

        # 最终清理所有内容
        cleaned_contents = self._clean_contents_for_gemini(
            contents,
            user_message=user_message,
            char_name=char_name,
            user_name=user_name,
            role_card=role_card
        )

        # 打印请求内容
        print("\n=== 发送给Gemini的请求内容 ===")
        print("消息数量:", len(cleaned_contents))
        print("包含的角色:", [msg["role"] for msg in cleaned_contents])
        print("完整内容:")
        print(json.dumps(cleaned_contents, indent=2, ensure_ascii=False))
        print("===========================\n")

        # 发送请求给Gemini
        response = self.adapter.generate_content(cleaned_contents)

        # 更新聊天历史中的AI响应并立即保存
        chat_history_index = next((i for i, item in enumerate(contents) 
                                if isinstance(item, dict) and item.get("name") == "Chat History"), None)
        
        if chat_history_index is not None:
            # 更新聊天历史
            contents[chat_history_index] = self.update_chat_history(
                contents[chat_history_index],
                user_message,
                response,
                d_entries
            )
            
            # 立即保存更新后的内容
            self.save_contents(contents, session_id)
            
            # 打印保存的内容以验证
            print("\n=== 保存的聊天历史 ===")
            print(json.dumps(contents[chat_history_index], indent=2, ensure_ascii=False))
            print("=====================\n")
        
        return response
