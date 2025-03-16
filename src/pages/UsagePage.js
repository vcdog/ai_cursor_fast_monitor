import React, { useEffect, useState } from 'react';
import UsageDisplay from '../components/UsageDisplay';
import AccountInfo from '../components/AccountInfo';
import { getFullUserProfile } from '../services/userService';
import { calculateUsageData } from '../services/usageService';
import './UsagePage.css';

function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [usageData, setUsageData] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const profile = await getFullUserProfile();
        setUserProfile(profile);
        
        // 根据用户资料计算使用量数据
        const usage = calculateUsageData(profile);
        setUsageData(usage);
        
        setLoading(false);
      } catch (err) {
        setError('获取数据失败，请稍后再试');
        setLoading(false);
        console.error('加载用户数据错误:', err);
      }
    }
    
    fetchData();
  }, []);
  
  if (loading) {
    return <div className="usage-page-loading">加载中...</div>;
  }
  
  if (error) {
    return <div className="usage-page-error">{error}</div>;
  }
  
  return (
    <div className="usage-page-container">
      <h1 className="usage-page-title">Cursor用量详情</h1>
      
      <AccountInfo userProfile={userProfile} />
      
      <div className="usage-section">
        <h2 className="usage-section-title">Premium模型使用量</h2>
        <UsageDisplay 
          used={usageData.premium.used} 
          total={usageData.premium.total} 
          percentage={usageData.premium.percentage}
        />
      </div>
      
      <div className="usage-section">
        <h2 className="usage-section-title">无限额请求使用量</h2>
        <UsageDisplay 
          used={usageData.unlimited.used} 
          total={usageData.unlimited.total} 
          percentage={usageData.unlimited.percentage}
          isUnlimited={true}
        />
      </div>
      
      <div className="usage-info">
        <p>下次重置日期: {userProfile.nextResetDate || '2025-04-12'}</p>
        <p>最后更新时间: {new Date().toLocaleString('zh-CN')}</p>
      </div>
      
      <div className="usage-actions">
        <button className="refresh-button">刷新数据</button>
        <button className="logs-button">查看日志</button>
      </div>
    </div>
  );
}

export default UsagePage; 