import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  Animated,
  PanResponder,
  LayoutChangeEvent
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { WorldBookEntryUI, PresetEntryUI } from '@/constants/types';
import { 
  POSITION_OPTIONS, 
  INSERT_TYPE_OPTIONS, 
  ROLE_OPTIONS,
  InputField,
  ToggleButton,
  styles as formStyles  // 添加这行，重命名导入的styles
} from './CharacterFormComponents';
import { theme } from '@/constants/theme';

interface WorldBookEntryProps {
  entry: WorldBookEntryUI;
  onUpdate: (id: string, updates: Partial<WorldBookEntryUI>) => void;
}

interface PresetEntryProps {
  entry: PresetEntryUI;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onUpdate: (id: string, updates: Partial<PresetEntryUI>) => void;
}

interface SectionProps {
  entries: WorldBookEntryUI[] | PresetEntryUI[];
  onAdd: () => void;
  onUpdate: (id: string, updates: any) => void;
  onMove?: (id: string, direction: 'up' | 'down') => void;
}

interface AuthorNoteSectionProps {
  content: string;
  injection_depth: number;
  onUpdateContent: (text: string) => void;
  onUpdateDepth: (depth: number) => void;
  onViewDetail?: (
    title: string, 
    content: string, 
    onContentChange: (text: string) => void, 
    editable?: boolean,
    entryType?: 'worldbook' | 'preset' | 'author_note',
    entryOptions?: any,
    onOptionsChange?: (options: any) => void
  ) => void;
}

export const renderWorldBookEntry = ({ entry, onUpdate }: WorldBookEntryProps) => (
  <View key={entry.id} style={styles.entryContainer}>
    <TextInput
      style={styles.input}
      value={entry.name}
      onChangeText={(text) => onUpdate(entry.id, { name: text })}
      placeholder="条目名称"
      placeholderTextColor="#999"
    />
    
    <TextInput
      style={[styles.input, styles.multilineInput]}
      value={entry.content}
      onChangeText={(text) => onUpdate(entry.id, { content: text })}
      placeholder="条目内容"
      placeholderTextColor="#999"
      multiline
    />

    <View style={styles.entryOptionsContainer}>
      <TouchableOpacity
        style={[styles.constantButton, entry.constant && styles.constantButtonActive]}
        onPress={() => onUpdate(entry.id, { constant: !entry.constant })}
      >
        <View style={[
          styles.circle,
          { backgroundColor: entry.constant ? '#4A90E2' : '#50C878' }
        ]} />
      </TouchableOpacity>

      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={entry.position ?? 4}
          onValueChange={(value) => onUpdate(entry.id, { position: value })}
          style={styles.picker}
        >
          {POSITION_OPTIONS.map(option => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>

      <TextInput
        style={styles.depthInput}
        value={String(entry.depth || 0)}
        onChangeText={(text) => onUpdate(entry.id, { depth: parseInt(text) || 0 })}
        keyboardType="numeric"
        placeholder="深度"
        placeholderTextColor="#999"
      />
    </View>

    <TextInput
      style={styles.input}
      value={entry.key?.join(', ')}
      onChangeText={(text) => onUpdate(entry.id, { key: text.split(',').map(k => k.trim()) })}
      placeholder="触发关键词（用逗号分隔）"
      placeholderTextColor="#999"
    />
  </View>
);

export const renderPresetEntry = ({ entry, onMove, onUpdate }: PresetEntryProps) => (
  <View key={entry.id} style={[
    styles.entryContainer,
    !entry.isEditable && styles.fixedEntryContainer
  ]}>
    <View style={styles.entryHeader}>
      <View style={styles.orderButtons}>
        <TouchableOpacity onPress={() => onMove(entry.id, 'up')} style={styles.orderButton}>
          <MaterialCommunityIcons name="chevron-up" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMove(entry.id, 'down')} style={styles.orderButton}>
          <MaterialCommunityIcons name="chevron-down" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {entry.isEditable ? (
        <TextInput
          style={[styles.nameInput, !entry.isEditable && styles.disabledInput]}
          value={entry.name}
          onChangeText={(text) => onUpdate(entry.id, { name: text })}
          placeholder="条目名称"
          placeholderTextColor="#999"
          editable={entry.isEditable}
        />
      ) : (
        <Text style={styles.fixedEntryName}>{entry.name}</Text>
      )}
    </View>

    <TextInput
      style={[styles.input, styles.multilineInput, !entry.isEditable && styles.disabledInput]}
      value={entry.content}
      onChangeText={(text) => onUpdate(entry.id, { content: text })}
      placeholder={entry.isEditable ? "条目内容" : "该条目内容由角色卡信息自动填充"}
      placeholderTextColor="#999"
      multiline
      editable={entry.isEditable}
    />

    {entry.isEditable && (
      <View style={styles.entryOptionsContainer}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={entry.insertType}
            onValueChange={(value) => onUpdate(entry.id, { 
              insertType: value,
              depth: value === 'chat' ? 0 : undefined
            })}
            style={styles.picker}
          >
            {INSERT_TYPE_OPTIONS.map(option => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={entry.role}
            onValueChange={(value) => onUpdate(entry.id, { role: value })}
            style={styles.picker}
          >
            {ROLE_OPTIONS.map(option => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>

        {entry.insertType === 'chat' && (
          <TextInput
            style={styles.depthInput}
            value={String(entry.depth || 0)}
            onChangeText={(text) => onUpdate(entry.id, { depth: parseInt(text) || 0 })}
            keyboardType="numeric"
            placeholder="深度"
            placeholderTextColor="#999"
          />
        )}
      </View>
    )}
  </View>
);

interface WorldBookSectionProps {
  entries: WorldBookEntryUI[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<WorldBookEntryUI>) => void;
  onViewDetail?: (
    title: string, 
    content: string, 
    onContentChange: (text: string) => void, 
    editable?: boolean,
    entryType?: 'worldbook' | 'preset' | 'author_note',
    entryOptions?: any,
    onOptionsChange?: (options: any) => void
  ) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export const WorldBookSection: React.FC<WorldBookSectionProps> = ({
  entries,
  onAdd,
  onUpdate,
  onViewDetail,
  onReorder
}) => {
  const [sortMode, setSortMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropAreaIndex, setDropAreaIndex] = useState<number | null>(null);
  const pointY = useRef(new Animated.Value(0)).current;
  const itemHeight = useRef(50);
  const containerRef = useRef<View>(null);
  const entryLayoutsRef = useRef<{[key: string]: {y: number, height: number}}>({});

  // Create a panResponder for drag-and-drop functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => sortMode,
      onMoveShouldSetPanResponder: () => sortMode,
      onPanResponderGrant: (_, gestureState) => {
        if (!sortMode) return false;
        
        const y = gestureState.y0;
        const entryId = Object.keys(entryLayoutsRef.current).find(key => {
          const layout = entryLayoutsRef.current[key];
          return y >= layout.y && y <= layout.y + layout.height;
        });
        
        if (entryId) {
          setDraggingId(entryId);
          pointY.setValue(gestureState.moveY);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (!draggingId || !sortMode) return;
        
        pointY.setValue(gestureState.moveY);
        
        // Determine potential drop position
        const currentY = gestureState.moveY;
        const positions = entries.map((entry, index) => {
          const layout = entryLayoutsRef.current[entry.id];
          if (!layout) return { index, y: index * itemHeight.current };
          return { index, y: layout.y + layout.height / 2 };
        });
        
        // Find closest position
        let closestIndex = 0;
        let minDistance = Number.MAX_VALUE;
        positions.forEach((pos) => {
          const distance = Math.abs(pos.y - currentY);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = pos.index;
          }
        });
        
        setDropAreaIndex(closestIndex);
      },
      onPanResponderRelease: () => {
        if (draggingId && dropAreaIndex !== null && onReorder && sortMode) {
          const fromIndex = entries.findIndex(e => e.id === draggingId);
          if (fromIndex !== dropAreaIndex) {
            onReorder(fromIndex, dropAreaIndex);
          }
        }
        setDraggingId(null);
        setDropAreaIndex(null);
      }
    })
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        // Container position data
      });
    }
  };
  
  const handleEntryLayout = (id: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    entryLayoutsRef.current[id] = { y, height };
  };

  return (
    <View 
      style={styles.sectionHeader} 
      ref={containerRef} 
      onLayout={handleLayout}
    >
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>世界观信息</Text>
        <View style={styles.headerButtonsContainer}>
          <TouchableOpacity 
            style={[styles.sortButton, sortMode && styles.sortButtonActive]}
            onPress={() => setSortMode(!sortMode)}
          >
            <MaterialIcons 
              name={sortMode ? "done" : "sort"} 
              size={20} 
              color={theme.colors.white} 
            />
            {sortMode && <Text style={styles.sortButtonText}>排序中</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={onAdd}
            disabled={sortMode}
            accessibilityLabel="添加世界观条目"
          >
            <MaterialIcons 
              name="add" 
              size={20} 
              color={sortMode ? theme.colors.textSecondary : theme.colors.white} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {entries.length === 0 ? (
        <TouchableOpacity 
          style={styles.emptyStateContainer}
          onPress={onAdd}
          disabled={sortMode}
        >
          <MaterialIcons name="add-circle-outline" size={32} color={theme.colors.textSecondary} />
          <Text style={styles.emptyStateText}>添加世界观信息</Text>
        </TouchableOpacity>
      ) : (
        <View {...(sortMode ? panResponder.panHandlers : {})}>
          {entries.map((entry, index) => {
            const isDragging = draggingId === entry.id;
            const isDropArea = dropAreaIndex === index && draggingId !== null && draggingId !== entry.id;
            
            return (
              <React.Fragment key={entry.id}>
                {isDropArea && sortMode && <View style={styles.dropArea} />}
                
                <View onLayout={(event) => handleEntryLayout(entry.id, event)}>
                  <TouchableOpacity
                    style={[
                      styles.entryItemCompact,
                      entry.disable && styles.disabledEntry,
                      entry.constant && styles.constantEntry,
                      isDragging && styles.draggingItem,
                      sortMode && styles.sortModeItem
                    ]}
                    onPress={() => {
                      if (!sortMode && onViewDetail) {
                        onViewDetail(
                          `世界观 - ${entry.name || '未命名'}`,
                          entry.content || '',
                          (text) => onUpdate(entry.id, { content: text }),
                          true,
                          'worldbook',
                          {
                            position: entry.position,
                            depth: entry.depth,
                            key: entry.key
                          },
                          (options) => onUpdate(entry.id, options)
                        );
                      }
                    }}
                    disabled={sortMode}
                  >
                    {sortMode && (
                      <View style={styles.dragHandle}>
                        <MaterialCommunityIcons name="drag" size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    
                    <InputField
                      label="名称"
                      value={entry.name || ''}
                      onChangeText={(text) => onUpdate(entry.id, { name: text })}
                      compact
                    />
                    
                    <View style={styles.buttonGroup}>
                      <ToggleButton
                        isDisabled={entry.disable}
                        onToggle={() => onUpdate(entry.id, { disable: !entry.disable })}
                      />
                      
                      <TouchableOpacity 
                        style={[
                          styles.constantButton, 
                          entry.constant && styles.constantButtonActive
                        ]}
                        onPress={() => onUpdate(entry.id, { constant: !entry.constant })}
                      >
                        <MaterialIcons 
                          name={entry.constant ? "lock" : "lock-open"} 
                          size={20} 
                          color={theme.colors.white}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {index === entries.length - 1 && dropAreaIndex === entries.length && sortMode && (
                  <View style={styles.dropArea} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      )}
      
      {sortMode && (
        <View style={styles.sortModeOverlay}>
          <Text style={styles.sortModeInstructions}>
            拖拽条目可调整顺序。点击排序模式下，条目详情暂不可编辑。
          </Text>
          <TouchableOpacity
            style={styles.doneSortingButton}
            onPress={() => setSortMode(false)}
          >
            <Text style={styles.doneSortingText}>完成排序</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

interface PresetSectionProps {
  entries: PresetEntryUI[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<PresetEntryUI>) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onViewDetail?: (
    title: string, 
    content: string, 
    onContentChange: (text: string) => void, 
    editable?: boolean,
    entryType?: 'worldbook' | 'preset' | 'author_note',
    entryOptions?: any,
    onOptionsChange?: (options: any) => void
  ) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export const PresetSection: React.FC<PresetSectionProps> = ({
  entries,
  onAdd,
  onUpdate,
  onMove,
  onViewDetail,
  onReorder
}) => {
  const [sortMode, setSortMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropAreaIndex, setDropAreaIndex] = useState<number | null>(null);
  const pointY = useRef(new Animated.Value(0)).current;
  const itemHeight = useRef(50);
  const containerRef = useRef<View>(null);
  const entryLayoutsRef = useRef<{[key: string]: {y: number, height: number}}>({});
  
  // Similar panResponder setup as WorldBookSection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => sortMode,
      onMoveShouldSetPanResponder: () => sortMode,
      onPanResponderGrant: (_, gestureState) => {
        if (!sortMode) return false;
        
        const y = gestureState.y0;
        const entryId = Object.keys(entryLayoutsRef.current).find(key => {
          const layout = entryLayoutsRef.current[key];
          return y >= layout.y && y <= layout.y + layout.height;
        });
        
        if (entryId) {
          setDraggingId(entryId);
          pointY.setValue(gestureState.moveY);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (!draggingId || !sortMode) return;
        
        pointY.setValue(gestureState.moveY);
        
        // Determine potential drop position
        const currentY = gestureState.moveY;
        const positions = entries.map((entry, index) => {
          const layout = entryLayoutsRef.current[entry.id];
          if (!layout) return { index, y: index * itemHeight.current };
          return { index, y: layout.y + layout.height / 2 };
        });
        
        // Find closest position
        let closestIndex = 0;
        let minDistance = Number.MAX_VALUE;
        positions.forEach((pos) => {
          const distance = Math.abs(pos.y - currentY);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = pos.index;
          }
        });
        
        setDropAreaIndex(closestIndex);
      },
      onPanResponderRelease: () => {
        if (draggingId && dropAreaIndex !== null && onReorder && sortMode) {
          const fromIndex = entries.findIndex(e => e.id === draggingId);
          if (fromIndex !== dropAreaIndex) {
            onReorder(fromIndex, dropAreaIndex);
          }
        }
        setDraggingId(null);
        setDropAreaIndex(null);
      }
    })
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        // Container position data
      });
    }
  };
  
  const handleEntryLayout = (id: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    entryLayoutsRef.current[id] = { y, height };
  };

  return (
    <View 
      style={styles.sectionHeader} 
      ref={containerRef} 
      onLayout={handleLayout}
    >
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>预设内容</Text>
        <View style={styles.headerButtonsContainer}>
          <TouchableOpacity 
            style={[styles.sortButton, sortMode && styles.sortButtonActive]}
            onPress={() => setSortMode(!sortMode)}
          >
            <MaterialIcons 
              name={sortMode ? "done" : "sort"} 
              size={20} 
              color={theme.colors.white} 
            />
            {sortMode && <Text style={styles.sortButtonText}>排序中</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={onAdd}
            disabled={sortMode}
            accessibilityLabel="添加预设条目"
          >
            <MaterialIcons 
              name="add" 
              size={20} 
              color={sortMode ? theme.colors.textSecondary : theme.colors.white} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {entries.length === 0 ? (
        <TouchableOpacity 
          style={styles.emptyStateContainer}
          onPress={onAdd}
          disabled={sortMode}
        >
          <MaterialIcons name="add-circle-outline" size={32} color={theme.colors.textSecondary} />
          <Text style={styles.emptyStateText}>添加预设内容</Text>
        </TouchableOpacity>
      ) : (
        <View {...(sortMode ? panResponder.panHandlers : {})}>
          {entries.map((entry, index) => {
            const isDragging = draggingId === entry.id;
            const isDropArea = dropAreaIndex === index && draggingId !== null && draggingId !== entry.id;
            
            return (
              <React.Fragment key={entry.id}>
                {isDropArea && sortMode && <View style={styles.dropArea} />}
                
                <View onLayout={(event) => handleEntryLayout(entry.id, event)}>
                  <TouchableOpacity
                    style={[
                      styles.entryItemCompact,
                      !entry.enable && styles.disabledEntry,
                      !entry.isEditable && styles.fixedEntryContainer,
                      isDragging && styles.draggingItem,
                      sortMode && styles.sortModeItem
                    ]}
                    onPress={() => {
                      if (!sortMode && onViewDetail) {
                        onViewDetail(
                          `预设 - ${entry.name || '未命名'}`,
                          entry.content || '',
                          (text) => onUpdate(entry.id, { content: text }),
                          entry.isEditable,
                          'preset',
                          {
                            insertType: entry.insertType,
                            role: entry.role,
                            depth: entry.depth
                          },
                          (options) => onUpdate(entry.id, options)
                        );
                      }
                    }}
                    disabled={sortMode}
                  >
                    {sortMode && (
                      <View style={styles.dragHandle}>
                        <MaterialCommunityIcons name="drag" size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    
                    <InputField
                      label="名称"
                      value={entry.name || ''}
                      onChangeText={(text) => onUpdate(entry.id, { name: text })}
                      editable={entry.isEditable}
                      compact
                    />
                    
                    <View style={styles.buttonGroup}>
                      <ToggleButton
                        isDisabled={!entry.enable}
                        onToggle={() => onUpdate(entry.id, { enable: !entry.enable })}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
                
                {index === entries.length - 1 && dropAreaIndex === entries.length && sortMode && (
                  <View style={styles.dropArea} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      )}
      
      {sortMode && (
        <View style={styles.sortModeOverlay}>
          <Text style={styles.sortModeInstructions}>
            拖拽条目可调整顺序。点击排序模式下，条目详情暂不可编辑。
          </Text>
          <TouchableOpacity
            style={styles.doneSortingButton}
            onPress={() => setSortMode(false)}
          >
            <Text style={styles.doneSortingText}>完成排序</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const AuthorNoteSection: React.FC<AuthorNoteSectionProps> = ({
  content,
  injection_depth,
  onUpdateContent,
  onUpdateDepth,
  onViewDetail
}) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>作者注释</Text>
      </View>
      <TouchableOpacity
        style={styles.entryItemCompact}
        onPress={() => {
          if (onViewDetail) {
            onViewDetail(
              '作者注释',
              content,
              onUpdateContent,
              true,
              'author_note',
              { depth: injection_depth },
              (options: any) => {
                if (options?.injection_depth !== undefined) {
                  onUpdateDepth(options.injection_depth);
                }
              }
            );
          }
        }}
      >
        <InputField
          label="注释内容"
          value={content}
          onChangeText={onUpdateContent}
          multiline
          compact
        />
        <View style={styles.buttonGroup}>
          <View style={styles.depthBadge}>
            <Text style={styles.depthBadgeText}>{injection_depth}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  ...formStyles,  // 使用重命名后的formStyles
  
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(50,50,50,0.5)',
  },

  emptyStateText: {
    color: theme.colors.textSecondary,
    marginTop: 8,
  },

  // New and updated styles
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Wider to accommodate text
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
  },
  sortButtonText: {
    color: theme.colors.black,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sortButtonActive: {
    backgroundColor: theme.colors.success,
  },
  entryItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(50,50,50,0.5)',
    marginBottom: 8,
    minHeight: 50,
  },
  dropArea: {
    height: 50,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 4,
    marginVertical: 4,
  },
  draggingItem: {
    opacity: 0.5,
  },
  sortModeItem: {
    backgroundColor: 'rgba(60,60,60,0.8)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  doneSortingButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    alignItems: 'center',
  },
  doneSortingText: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  sortModeOverlay: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  sortModeInstructions: {
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  dragHandle: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.6)',
    marginRight: 8,
  },

  constantEntry: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  depthBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    minWidth: 24,
    alignItems: 'center',
  },
  depthBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
