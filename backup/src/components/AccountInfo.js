import React from 'react';
import './AccountInfo.css';

function AccountInfo({ userProfile }) {
  if (!userProfile) {
    return <div className="account-info-loading">加载用户信息中...</div>;
  }
  
  const { email } = userProfile;
  const accountType = getAccountTypeLabel(userProfile.subscription);
  
  return (
    <div className="account-info-container">
      <div className="account-info-header">账户信息</div>
      <div className="account-info-content">
        <div className="account-info-item">
          <span className="account-info-label">邮箱:</span>
          <span className="account-info-value">{email}</span>
        </div>
        <div className="account-info-item">
          <span className="account-info-label">账户类型:</span>
          <span className={`account-info-value account-type-${accountType.toLowerCase()}`}>
            {accountType}
          </span>
        </div>
      </div>
    </div>
  );
}

// 根据订阅信息确定账户类型
function getAccountTypeLabel(subscription) {
  if (!subscription) return '免费用户';
  
  const { plan, status } = subscription;
  
  if (status !== 'active') return '免费用户';
  
  switch (plan?.toLowerCase()) {
    case 'premium':
      return 'Premium会员';
    case 'pro':
      return 'Pro会员';
    case 'team':
      return '团队版';
    case 'enterprise':
      return '企业版';
    default:
      return '免费用户';
  }
}

export default AccountInfo; 