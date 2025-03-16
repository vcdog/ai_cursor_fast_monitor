// 用户服务 - 获取用户信息和账户类型
import axios from 'axios';

// 获取用户基本信息
export async function getUserInfo() {
  try {
    const response = await axios.get('https://www.cursor.com/api/auth/me');
    return response.data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
}

// 获取用户订阅信息
export async function getUserSubscription() {
  try {
    const response = await axios.get('https://www.cursor.com/api/auth/stripe');
    return response.data;
  } catch (error) {
    console.error('获取订阅信息失败:', error);
    throw error;
  }
}

// 获取完整用户资料（合并基本信息和订阅信息）
export async function getFullUserProfile() {
  try {
    const [userInfo, subscription] = await Promise.all([
      getUserInfo(),
      getUserSubscription()
    ]);
    
    return {
      ...userInfo,
      subscription
    };
  } catch (error) {
    console.error('获取用户资料失败:', error);
    throw error;
  }
} 