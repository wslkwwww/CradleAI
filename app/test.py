import json
import re
from typing import Dict, Any, Optional


def main(arg1: str) -> Dict[str, Any]:
    """
    从输入的字符串中提取【【角色人设】】和【【查看朋友圈内容】】后面的JSON字符串，并将每个属性值转换为包含 "value" 键的字典对象。
    更鲁棒的处理JSON字符串，包括提取嵌入的JSON。
    """
    circle_post: Optional[Dict[str, Any]] = None  # 初始化 circle_post 为 None

    try:
        # 1. 提取朋友圈内容 JSON 字符串
        circle_match = re.search(r'【【查看朋友圈内容】】(\{.*?\})(?=【【|$)', arg1)  # 修改后的正则表达式
        if circle_match:
            circle_json_string = circle_match.group(1)
            cleaned_circle_json = circle_json_string.strip()
            cleaned_circle_json = re.sub(r'\\(.)', r'\1', cleaned_circle_json)
            cleaned_circle_json = cleaned_circle_json.replace('None', 'null')
            cleaned_circle_json = ''.join(ch for ch in cleaned_circle_json if ch.isprintable())
            try:
                circle_post = json.loads(cleaned_circle_json)
            except json.JSONDecodeError as e:
                print(f"Error decoding circle JSON: {e}, line: {e.lineno}, column: {e.colno}")
                print(f"Problematic circle JSON string: {cleaned_circle_json}")
                circle_post = {}  # 解析失败，赋予空字典
            except Exception as e:
                print(f"Error processing circle JSON: {e}")
                circle_post = {}  # 解析失败，赋予空字典
        else:
            print("No JSON string found after 【【查看朋友圈内容】】 in input.")
            circle_post = {} # 未找到，赋予空字典

        # 2. 提取角色人设 JSON 字符串
        character_match = re.search(r'【【角色人设】】(\{.*\})', arg1)
        if not character_match:
            print("No JSON string found after 【【角色人设】】 in input.")
            data = {}  # 如果没有找到角色人设，返回一个空字典
        else:
            character_json_string = character_match.group(1)
            cleaned_character_json = character_json_string.strip()
            cleaned_character_json = re.sub(r'\\(.)', r'\1', cleaned_character_json)
            cleaned_character_json = cleaned_character_json.replace('None', 'null')
            cleaned_character_json = ''.join(ch for ch in cleaned_character_json if ch.isprintable())

            try:
                data: Dict[str, Any] = json.loads(cleaned_character_json)  # 添加类型提示
            except json.JSONDecodeError as e:  # 捕获 JSON 解析错误
                print(f"Error decoding character JSON: {e}, line: {e.lineno}, column: {e.colno}")
                print(f"Problematic character JSON string: {cleaned_character_json}")
                data = {}  # 如果 JSON 解析失败，返回一个空字典
            except Exception as e:
                print(f"Error processing character JSON: {e}")
                data = {}  # 如果发生其他错误，返回一个空字典

        # 3. 提取角色信息并转换为字典对象，并添加 circle_post
        return {
            "char_name": {"value": data.get("name", "")},  # 使用 get() 方法，防止 KeyError 错误
            "char_race": {"value": data.get("race", "")},
            "char_age": {"value": data.get("age", "")},
            "char_occupation": {"value": data.get("occupation", "")},
            "char_appearance": {"value": data.get("appearance", "")},
            "char_persona": {"value": data.get("personality", "")},  # 修改为正确字段
            "char_ability": {"value": data.get("ability", "")},
            "char_relationships": {"value": data.get("relationship", "")},  # 修改为正确字段
            "worldview": {"value": data.get("worldview", "")},
            "circle_post": circle_post  # 添加 circle_post
        }

    except Exception as e:
        print(f"Error processing input: {e}")
        return {}  # 如果发生其他错误，返回一个空字典


# 示例用法
input_string = '【【查看朋友圈内容】】{"content": "Hello world!", "timestamp": "2023-10-27"}【【角色人设】】{"name": "Alice", "race": "Elf", "age": "200", "occupation": "Mage", "appearance": "Beautiful", "personality": "Kind", "ability": "Magic", "relationship": "Friends", "worldview": "Good"}'
result = main(input_string)
print(result)
