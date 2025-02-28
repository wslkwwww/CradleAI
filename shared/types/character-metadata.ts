export interface CharacterMetadata {
  firstMeetingDate?: number;
  favoriteTopics?: string[];
  notes?: string;
  customTags?: string[];
  location?: string;
  occupation?: string;
  [key: string]: any; // Allow for additional custom metadata
}
