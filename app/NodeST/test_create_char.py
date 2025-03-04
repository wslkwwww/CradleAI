
import json
import time
from typing import Dict, Optional
from test_config import (
    TEST_CONVERSATION_ID,
    TEST_PRESET_JSON,
    TEST_ROLE_CARD_JSON,
    TEST_WORLD_BOOK_JSON,
    TEST_AUTHOR_NOTE_JSON
)
from chat_manager import ChatManager
from character_utils import build_r_framework, extract_d_entries

class CreateCharTester:
    def __init__(self):
        self.conversation_id = TEST_CONVERSATION_ID
        self.user_message = "你好"
        
    def validate_json_structure(self, json_obj: Dict, expected_keys: list, name: str) -> tuple[bool, str]:
        """验证JSON结构是否符合要求"""
        missing_keys = [key for key in expected_keys if key not in json_obj]
        if missing_keys:
            return False, f"{name} 缺少必要字段: {', '.join(missing_keys)}"
        return True, "验证通过"

    def test_json_compatibility(self):
        """测试JSON文件兼容性"""
        print("\n=== 开始测试JSON兼容性 ===\n")

        # 1. 验证JSON结构
        validations = [
            (TEST_PRESET_JSON, ["prompts", "prompt_order"], "预设JSON"),
            (TEST_ROLE_CARD_JSON, ["name", "first_mes"], "角色卡JSON"),
            (TEST_WORLD_BOOK_JSON, ["entries"], "世界观JSON"),
            (TEST_AUTHOR_NOTE_JSON, ["charname", "username", "content"], "作者注释JSON")
        ]

        for json_obj, expected_keys, name in validations:
            is_valid, message = self.validate_json_structure(json_obj, expected_keys, name)
            if not is_valid:
                print(f"❌ {message}")
                return False
            print(f"✅ {name}结构验证通过")

        try:
            # 2. 测试R框架构建
            print("\n正在测试R框架构建...")
            r_framework, chat_history = build_r_framework(
                TEST_PRESET_JSON,
                TEST_ROLE_CARD_JSON,
                TEST_WORLD_BOOK_JSON
            )
            
            print(f"✅ R框架构建成功")
            print(f"- 包含 {len(r_framework)} 个条目")
            print(f"- Chat History {'已找到' if chat_history else '未找到'}")

            # 3. 测试D类条目提取
            print("\n正在测试D类条目提取...")
            d_entries = extract_d_entries(
                TEST_PRESET_JSON,
                TEST_WORLD_BOOK_JSON,
                TEST_AUTHOR_NOTE_JSON
            )
            
            print(f"✅ D类条目提取成功")
            print(f"- 提取到 {len(d_entries)} 个D类条目")

            # 4. 测试Gemini请求体生成
            print("\n正在测试Gemini请求体生成...")
            dummy_api_key = "test_key"
            chat_manager = ChatManager(dummy_api_key)
            
            # 创建测试请求
            test_contents = []
            for item in r_framework:
                if item["name"] == "Chat History":
                    chat_history = {
                        "name": "Chat History",
                        "role": "system",
                        "parts": [
                            {
                                "role": "model",
                                "parts": [{"text": TEST_ROLE_CARD_JSON["first_mes"]}],
                                "is_first_mes": True
                            }
                        ]
                    }
                    chat_history = chat_manager._insert_d_entries_to_history(
                        chat_history,
                        d_entries,
                        self.user_message,
                        True  # has_first_mes
                    )
                    test_contents.append(chat_history)
                else:
                    test_contents.append(item)

            cleaned_contents = chat_manager._clean_contents_for_gemini(
                test_contents,
                self.user_message,
                TEST_ROLE_CARD_JSON["name"],
                TEST_AUTHOR_NOTE_JSON["username"],
                TEST_ROLE_CARD_JSON
            )

            print("✅ Gemini请求体生成成功")
            print(f"- 请求体包含 {len(cleaned_contents)} 个消息")
            
            # 5. 验证请求体结构
            for content in cleaned_contents:
                if not isinstance(content, dict) or "role" not in content or "parts" not in content:
                    print("❌ 请求体结构验证失败")
                    return False

            print("\n=== 测试完成 ===")
            print("✅ 所有测试通过！")
            print("\n详细的请求体结构:")
            print(json.dumps(cleaned_contents, ensure_ascii=False, indent=2))
            
            return True

        except Exception as e:
            print(f"\n❌ 测试过程中出现错误:")
            print(f"错误信息: {str(e)}")
            import traceback
            print("详细错误堆栈:")
            print(traceback.format_exc())
            return False

def main():
    tester = CreateCharTester()
    success = tester.test_json_compatibility()
    
    if success:
        print("\n✅ 测试通过: create_char生成的JSON文件格式正确且可用")
    else:
        print("\n❌ 测试失败: 请检查上述错误信息并修改create_char的相关代码")

if __name__ == "__main__":
    main()
