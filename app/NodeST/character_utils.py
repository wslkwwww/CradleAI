import os
import json
from typing import Dict, Tuple, List

def load_json(json_str: str) -> Dict:
    """从JSON字符串加载数据"""
    if not isinstance(json_str, str):
        return {}
        
    try:
        data = json.loads(json_str)
        return data if data else {}
    except json.JSONDecodeError:
        print(f"错误: 无法解析JSON字符串")
        return {}

def build_r_framework(preset_json, role_card_json, world_book_json):
    """构建R框架，排除injection_position=1的D类条目"""
    r_entries = []
    chathistory = None
    
    # 从 preset_json 中提取 prompt_order
    prompt_order = []
    prompt_order_list = preset_json.get("prompt_order", [])
    if (prompt_order_list):
        first_order = prompt_order_list[0].get("order", [])
        prompt_order = [item['identifier'] for item in first_order if item.get("enabled", True)]

    print("prompt_order:", prompt_order)

    # 遍历 prompts 数组,找到所有的 R类条目和 ChatHistory
    for item in preset_json.get("prompts", []):
        # 重要修改：排除 injection_position=1 的条目
        if item.get('injection_position') == 1:  # 跳过所有 injection_position=1 的条目
            continue
            
        if item.get('enable', True):  # 过滤掉 enable = false 的条目
            r_entry = {
                "name": item['name'],
                "role": "user",
                "parts": [{"text": ""}],
                "identifier": item.get("identifier")
            }

            # 修正映射关系，使其与test_config.py中的字段名完全匹配
            if r_entry["identifier"] == "charDescription":  # 修改判断条件
                r_entry["parts"][0]["text"] = role_card_json.get("description", "")
            elif r_entry["identifier"] == "charPersonality":  # 修改判断条件
                r_entry["parts"][0]["text"] = role_card_json.get("personality", "")
            elif r_entry["identifier"] == "scenario":  # 保持不变
                r_entry["parts"][0]["text"] = role_card_json.get("scenario", "")
            elif r_entry["identifier"] == "dialogueExamples":  # 修改判断条件
                r_entry["parts"][0]["text"] = role_card_json.get("mes_example", "")
            else:
                r_entry["parts"][0]["text"] = item.get("content", "")

            # 修改这部分：不再跳过 Chat History
            if r_entry["name"] == "Chat History":
                chathistory = {
                    "name": "Chat History",
                    "role": "system",  # 改为 system
                    "parts": [],
                    "identifier": item.get("identifier")  # 保留identifier
                }
                r_entries.append(chathistory)  # 添加到 r_entries
            else:
                r_entries.append(r_entry)

    # 使用 prompt_order 进行排序,  并决定 最终 r_framework 的条目顺序
    sorted_r_entries = []
    for identifier in prompt_order:
        # 根据identifier 找到 对应的条目
        for r_entry in r_entries:
            if r_entry["identifier"] == identifier:
                sorted_r_entries.append(r_entry)
                break

    # 找到 chathistory 在排序后的位置
    chathistory = next((entry for entry in sorted_r_entries if entry["name"] == "Chat History"), None)
    
    # 插入基于position的D类条目到R框架中
    position_based_entries = []
    
    # 从世界书中提取position=0或1的D类条目
    for key, entry in world_book_json.get('entries', {}).items():
        if entry.get('disable') == False and entry.get('position') in [0, 1]:
            d_entry = {
                "name": entry['comment'],
                "role": "user",
                "parts": [{"text": entry['content']}],
                "position": entry.get('position'),
                "insertion_order": entry.get('order', 0)
            }
            position_based_entries.append(d_entry)
    
    # 按insertion_order排序
    position_based_entries.sort(key=lambda x: x['insertion_order'])
    
    # 找到Char Description的位置
    char_desc_index = next((i for i, entry in enumerate(sorted_r_entries) 
                          if entry["name"] == "Char Description"), -1)
    
    if char_desc_index != -1:
        # 按照position的值分组
        before_entries = [e for e in position_based_entries if e['position'] == 0]
        after_entries = [e for e in position_based_entries if e['position'] == 1]
        
        # 在Char Description前后插入条目
        for entry in reversed(before_entries):  # 反序插入以保持原有顺序
            sorted_r_entries.insert(char_desc_index, entry)
        
        for entry in after_entries:
            sorted_r_entries.insert(char_desc_index + 1, entry)
            char_desc_index += 1  # 更新索引位置

    return sorted_r_entries, chathistory

def extract_d_entries(preset_json, world_book_json, author_note_json=None):
    """提取所有D类条目，包括预设中的injection_position=1的条目"""
    d_entries = []
    
    # 首先从prompt_order中提取enabled状态的映射
    enabled_identifiers = {}
    prompt_order_list = preset_json.get("prompt_order", [])
    if prompt_order_list:
        # 获取第一个order列表（通常只有一个）
        first_order = prompt_order_list[0].get("order", [])
        # 创建identifier到enabled状态的映射
        enabled_identifiers = {
            item['identifier']: item.get('enabled', False) 
            for item in first_order
        }
    
    print("\n=== 调试: 从预设提取D类条目 ===")
    for item in preset_json.get("prompts", []):
        if item.get('injection_position') == 1:
            identifier = item.get('identifier')
            # 检查该条目在prompt_order中是否启用
            if identifier and enabled_identifiers.get(identifier, False):
                d_entry = {
                    "name": item['name'],
                    "content": item.get('content', ''),
                    "role": item.get('role', 'user'),
                    "injection_depth": item.get('injection_depth', 0),
                    "identifier": identifier,  # 保留identifier
                    "injection_position": 1  # 标记来源
                }
                d_entries.append(d_entry)
                print(f"从preset添加injection_position=1的D类条目: {d_entry['name']}")
                print(f"- identifier: {identifier}")
                print(f"- injection_depth: {d_entry['injection_depth']}")
                print(f"- content: {d_entry['content'][:50]}...")
            else:
                print(f"跳过禁用的D类条目: {item.get('name')}")
                print(f"- identifier: {identifier}")
                print(f"- enabled in prompt_order: {enabled_identifiers.get(identifier, False)}")

    # 添加作者注释
    if author_note_json:
        author_note = {
            "name": "Author Note",
            "content": author_note_json.get("content", ""),
            "role": author_note_json.get("role", "user"),
            "injection_depth": author_note_json.get("injection_depth", 0),
            "is_author_note": True
        }
        d_entries.append(author_note)
        print(f"添加作者注释: {author_note}")

    # 从角色世界书 JSON 中提取 D 类条目
    print("\n=== 调试: 世界书D类条目提取 ===")
    for key, entry in world_book_json.get('entries', {}).items():
        # 打印每个条目的关键信息
        print(f"\n检查条目 {key}:")
        print(f"- position: {entry.get('position')}")
        print(f"- constant: {entry.get('constant')}")
        print(f"- disable: {entry.get('disable')}")
        print(f"- key: {entry.get('key')}")
        
        # 检查 position 值，只处理 position=4,2,3 的条目
        if entry.get('disable') == False and entry.get('position') in [2, 3, 4]:
            d_entry = {
                "name": entry['comment'],
                "content": entry['content'],
                "role": "user",
                "position": entry.get('position'),
                "key": entry.get('key'),  
                "constant": entry.get('constant'),  # 确保正确获取constant
                "insertion_order": entry.get('order', 0),
                "vectorized": entry.get('vectorized'),
                "injection_depth": entry.get('depth', 0)
            }
            
            # 检查条目是否被添加
            if d_entry['position'] in [2, 3] and not author_note_json:
                print(f"跳过条目 {key}: position={d_entry['position']}, 无作者注释")
                continue
                
            d_entries.append(d_entry)
            print(f"添加D类条目: {key}")
            print(f"- constant值: {d_entry['constant']}")
            print(f"- key值: {d_entry['key']}")

    # 打印统计信息
    constant_false_entries = [d for d in d_entries if d.get('constant') is False]
    print("\n=== D类条目统计 ===")
    print(f"总条目数: {len(d_entries)}")
    print(f"constant=False的条目数: {len(constant_false_entries)}")
    print("constant=False的条目详情:")
    for d in constant_false_entries:
        print(f"- 名称: {d.get('name')}")
        print(f"  key: {d.get('key')}")
        print(f"  position: {d.get('position')}")

    return d_entries
