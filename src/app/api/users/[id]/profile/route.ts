import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    
    // 读取用户数据
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = usersData.find((u: any) => u.id === userId);
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: '用户不存在' 
      }, { status: 404 });
    }

    // 返回用户资料（不包含密码）
    const { password, ...userProfile } = user;
    
    return NextResponse.json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    console.error('获取用户资料失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '服务器错误' 
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const updates = await request.json();
    
    // 读取用户数据
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const userIndex = usersData.findIndex((u: any) => u.id === userId);
    
    if (userIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        error: '用户不存在' 
      }, { status: 404 });
    }

    // 更新用户数据（只允许更新特定字段）
    const allowedFields = ['username', 'friends', 'savedScripts', 'collectedScripts', 'gameHistory', 'chatHistory'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        usersData[userIndex][field] = updates[field];
      }
    }

    // 保存更新后的数据
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
    
    // 返回更新后的用户资料（不包含密码）
    const { password, ...userProfile } = usersData[userIndex];
    
    return NextResponse.json({
      success: true,
      user: userProfile,
      message: '用户资料更新成功'
    });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '服务器错误' 
    }, { status: 500 });
  }
}
