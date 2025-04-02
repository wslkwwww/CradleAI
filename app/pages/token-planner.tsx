import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView,
  StatusBar,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import ModelInputForm from '@/components/token-planner/ModelInputForm';
import ModelResultList from '@/components/token-planner/ModelResultList';
import LoadingIndicator from '@/components/LoadingIndicator';
import Header from '@/components/Header';

interface ModelData {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
    input_cache_read: string;
    input_cache_write: string;
    web_search: string;
    internal_reasoning: string;
  };
  context_length: number;
  architecture?: {
    input_modalities: string[];
    output_modalities: string[];
  };
}

interface InputValues {
  userInputWords: number;
  expectedOutputWords: number;
  roleCardWords: number;
  imageCount: number;
  includeImages: boolean;
  conversationTurns: number;
  monthlyBudget: number;
  dailyChats: number;
  tokenPerWordRatio: number;
}

interface CalculationResult {
  modelId: string;
  modelName: string;
  modelDescription: string;
  estimatedMonthlyCost: number;
  daysCanChat: number;
  totalMonthlyTokens: number;
  inputCost: number;
  outputCost: number;
  imageCost: number;
  contextLength: number;
  hasImageCapability: boolean;
}

const TokenPlanner: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelData[]>([]);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Default values for input form
  const defaultValues: InputValues = {
    userInputWords: 100,
    expectedOutputWords: 200,
    roleCardWords: 500,
    imageCount: 0,
    includeImages: false,
    conversationTurns: 5,
    monthlyBudget: 30,
    dailyChats: 300,
    tokenPerWordRatio: 0.75
  };

  const [inputValues, setInputValues] = useState<InputValues>(defaultValues);

  // Fetch models from API when component mounts
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add a small artificial delay to ensure loading shows
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch('https://openrouter.ai/api/v1/models');
      
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const data = await response.json();
      setModels(data.data);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError('获取模型列表失败，请检查网络连接或稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const calculateCosts = (values: InputValues) => {
    setLoading(true);
    setError(null);

    try {
      const calculationResults: CalculationResult[] = models.map(model => {
        // Calculate tokens
        const inputTokens = values.userInputWords * values.tokenPerWordRatio;
        const outputTokens = values.expectedOutputWords * values.tokenPerWordRatio;
        const roleCardTokens = values.roleCardWords * values.tokenPerWordRatio;
        const chatHistoryTokens = values.conversationTurns * (inputTokens + outputTokens);
        const totalTokensPerChat = inputTokens + outputTokens + roleCardTokens + chatHistoryTokens;
        const totalDailyTokens = totalTokensPerChat * values.dailyChats;
        const totalMonthlyTokens = totalDailyTokens * 30;
        
        // Parse pricing info
        const inputPricePerToken = parseFloat(model.pricing.prompt) || 0;
        const outputPricePerToken = parseFloat(model.pricing.completion) || 0;
        const imagePricePerImage = parseFloat(model.pricing.image) || 0;
        
        // Calculate costs
        const inputCost = (totalMonthlyTokens / 1000000) * inputPricePerToken * 1000000;
        const outputCost = (totalMonthlyTokens / 1000000) * outputPricePerToken * 1000000;
        const imageCost = values.includeImages ? 
          (values.imageCount / 1000000) * imagePricePerImage * 1000000 : 0;
        
        const totalMonthlyCost = inputCost + outputCost + imageCost;
        
        // Calculate days can chat
        let daysCanChat = 0;
        if (totalMonthlyCost > 0) {
          const dailyCost = totalMonthlyCost / 30;
          daysCanChat = values.monthlyBudget / dailyCost;
        } else {
          daysCanChat = 9999; // Effectively unlimited
        }
        
        // Check if model supports image input
        const hasImageCapability = model.architecture?.input_modalities?.includes('image') || false;
        
        return {
          modelId: model.id,
          modelName: model.name,
          modelDescription: model.description || '',
          estimatedMonthlyCost: totalMonthlyCost,
          daysCanChat: daysCanChat,
          totalMonthlyTokens: totalMonthlyTokens,
          inputCost: inputCost,
          outputCost: outputCost,
          imageCost: imageCost,
          contextLength: model.context_length,
          hasImageCapability
        };
      });
      
      // Sort results by estimated cost (ascending)
      calculationResults.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
      setResults(calculationResults);
    } catch (err) {
      console.error('Error calculating costs:', err);
      setError('计算费用时发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (values: InputValues) => {
    setInputValues(values);
    calculateCosts(values);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <Header title="模型费用计算器" showBackButton onBackPress={() => router.back()} />
      
      <ScrollView style={styles.container}>
        <View style={styles.introContainer}>
          <Text style={styles.introTitle}>优化您的 AI 使用成本</Text>
          <Text style={styles.introDescription}>
            基于您的使用习惯估算不同模型的费用，帮助您做出更明智的选择。
          </Text>
        </View>

        <ModelInputForm 
          defaultValues={inputValues} 
          onSubmit={handleFormSubmit}
          onRefreshModels={fetchModels}
        />

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : results.length > 0 ? (
          <ModelResultList 
            results={results} 
            monthlyBudget={inputValues.monthlyBudget}
            includeImages={inputValues.includeImages}
          />
        ) : !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              请填写您的使用习惯并点击 "计算费用" 按钮
            </Text>
          </View>
        )}
      </ScrollView>

      <LoadingIndicator 
        visible={loading} 
        text="加载中..." 
        overlay={true}
        useModal={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  introContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 8,
    marginVertical: 16,
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
  }
});

export default TokenPlanner;
