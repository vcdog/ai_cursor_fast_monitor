function calculateUsageData(userData) {
  const result = {
    premium: {
      used: userData.premiumUsed || 0,
      total: userData.premiumTotal || 0,
      percentage: 0
    },
    unlimited: {
      used: userData.unlimitedUsed || 0,
      total: null, // 使用null表示无限
      percentage: 0.1 // 固定显示很小的百分比
    }
  };
  
  // 计算premium使用百分比
  if (result.premium.total > 0) {
    result.premium.percentage = Math.min((result.premium.used / result.premium.total) * 100, 100);
  }
  
  return result;
} 