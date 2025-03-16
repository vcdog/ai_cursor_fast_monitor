import React from 'react';
import './UsageDisplay.css';

function UsageDisplay({ used, total, percentage, isUnlimited }) {
  return (
    <div className="usage-display">
      {renderUsageBar(used, total, isUnlimited)}
    </div>
  );
}

function renderUsageBar(used, total, isUnlimited) {
  // 添加对无限额度的处理
  if (total === 0 || total === null || isUnlimited) { // 无限额度情况
    const percentage = 0.1; // 显示一个很小的固定百分比
    return (
      <div className="usage-container">
        <div className="progress-bar">
          <div 
            className="progress-fill infinite" 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="usage-text">
          <span>已使用: {used}</span>
          <span>总量: <span className="infinite-symbol">∞</span></span>
        </div>
      </div>
    );
  }
  
  // 正常有限额度情况
  const percentage = Math.min((used / total) * 100, 100);
  return (
    <div className="usage-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="usage-text">
        <span>已使用: {used}</span>
        <span>总量: {total}</span>
      </div>
    </div>
  );
}

export default UsageDisplay; 