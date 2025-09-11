import fs from 'fs';
import path from 'path';
import { User, Room, Script, GameRecord, ScriptRatingRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// 确保数据目录存在
export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 通用文件操作
function readJsonFile<T>(filename: string): T[] {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
}

// 单文件读取（非数组场景可扩展）
function readJsonRaw(filename: string): any {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath,'utf8')); } catch { return null; }
}

function writeJsonFile<T>(filename: string, data: T[]): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  }
}

// 用户数据操作
export function getUsers(): User[] {
  return readJsonFile<User>('users.json');
}

export function saveUsers(users: User[]): void {
  writeJsonFile('users.json', users);
}

export function getUserById(id: string): User | null {
  const users = getUsers();
  return users.find(user => user.id === id) || null;
}

export function getUserByUsername(username: string): User | null {
  const users = getUsers();
  return users.find(user => user.username === username) || null;
}

export function updateUser(updatedUser: User): void {
  const users = getUsers();
  const index = users.findIndex(user => user.id === updatedUser.id);
  
  if (index !== -1) {
    users[index] = updatedUser;
    saveUsers(users);
  } else {
    throw new Error('User not found');
  }
}

export function createUser(user: User): void {
  const users = getUsers();
  users.push(user);
  saveUsers(users);
}

// 房间数据操作
export function getRooms(): Room[] {
  return readJsonFile<Room>('rooms.json');
}

export function saveRooms(rooms: Room[]): void {
  writeJsonFile('rooms.json', rooms);
}

export function getRoomById(id: string): Room | null {
  const rooms = getRooms();
  return rooms.find(room => room.id === id) || null;
}

export function updateRoom(updatedRoom: Room): void {
  const rooms = getRooms();
  const index = rooms.findIndex(room => room.id === updatedRoom.id);
  
  if (index !== -1) {
    rooms[index] = updatedRoom;
    saveRooms(rooms);
  } else {
    throw new Error('Room not found');
  }
}

export function createRoom(room: Room): void {
  const rooms = getRooms();
  rooms.push(room);
  saveRooms(rooms);
}

export function deleteRoom(id: string): void {
  const rooms = getRooms();
  const filteredRooms = rooms.filter(room => room.id !== id);
  saveRooms(filteredRooms);
}

// 剧本数据操作
export function getScripts(): Script[] {
  return readJsonFile<Script>('scripts.json');
}

export function saveScripts(scripts: Script[]): void {
  writeJsonFile('scripts.json', scripts);
}

export function getScriptById(id: string): Script | null {
  const scripts = getScripts();
  return scripts.find(script => script.id === id) || null;
}

export function updateScript(updatedScript: Script): void {
  const scripts = getScripts();
  const index = scripts.findIndex(script => script.id === updatedScript.id);
  
  if (index !== -1) {
    scripts[index] = updatedScript;
    saveScripts(scripts);
  } else {
    throw new Error('Script not found');
  }
}

export function createScript(script: Script): void {
  const scripts = getScripts();
  scripts.push(script);
  saveScripts(scripts);
}

// 评分相关 -------------------------------------------------
const RATINGS_FILE = 'scriptRatings.json';

export function getScriptRatings(): ScriptRatingRecord[] {
  return readJsonFile<ScriptRatingRecord>(RATINGS_FILE);
}

export function saveScriptRatings(ratings: ScriptRatingRecord[]): void {
  writeJsonFile(RATINGS_FILE, ratings);
}

export function upsertScriptRating(scriptId: string, userId: string, rating: number): { average: number; count: number } {
  const ratings = getScriptRatings();
  let record = ratings.find(r => r.scriptId === scriptId && r.userId === userId);
  if (!record) {
    record = { id: `rating_${scriptId}_${userId}`, scriptId, userId, rating, ratedAt: Date.now() };
    ratings.push(record);
  } else {
    record.rating = rating;
    record.ratedAt = Date.now();
  }
  saveScriptRatings(ratings);
  // 更新脚本聚合
  const scriptList = getScripts();
  const scriptIndex = scriptList.findIndex(s => s.id === scriptId);
  if (scriptIndex !== -1) {
    const scriptRatings = ratings.filter(r => r.scriptId === scriptId);
    const avg = scriptRatings.reduce((a,b)=>a+b.rating,0) / (scriptRatings.length || 1);
    scriptList[scriptIndex].averageRating = parseFloat(avg.toFixed(2));
    scriptList[scriptIndex].ratingCount = scriptRatings.length;
    saveScripts(scriptList);
    return { average: scriptList[scriptIndex].averageRating!, count: scriptList[scriptIndex].ratingCount! };
  }
  return { average: rating, count: 1 };
}

export function getScriptAggregateRating(scriptId: string): { average: number; count: number } {
  const ratings = getScriptRatings().filter(r => r.scriptId === scriptId);
  if (ratings.length === 0) return { average: 0, count: 0 };
  const avg = ratings.reduce((a,b)=>a+b.rating,0)/ratings.length;
  return { average: parseFloat(avg.toFixed(2)), count: ratings.length };
}

// 用户余额初始化（惰性）
export function ensureUserEconomicFields(user: User, persist = true): User {
  let changed = false;
  if (user.balance === undefined) { user.balance = 100; changed = true; }
  if (!user.purchasedScripts) { user.purchasedScripts = []; changed = true; }
  if (changed && persist) updateUser(user);
  return user;
}

// 游戏记录数据操作
export function getGameRecords(): GameRecord[] {
  return readJsonFile<GameRecord>('gameRecords.json');
}

export function saveGameRecords(gameRecords: GameRecord[]): void {
  writeJsonFile('gameRecords.json', gameRecords);
}

export function getGameRecordById(id: string): GameRecord | null {
  const gameRecords = getGameRecords();
  return gameRecords.find(record => record.id === id) || null;
}

export function updateGameRecord(updatedRecord: GameRecord): void {
  const gameRecords = getGameRecords();
  const index = gameRecords.findIndex(record => record.id === updatedRecord.id);
  
  if (index !== -1) {
    gameRecords[index] = updatedRecord;
    saveGameRecords(gameRecords);
  } else {
    throw new Error('Game record not found');
  }
}

export function createGameRecord(gameRecord: GameRecord): void {
  const gameRecords = getGameRecords();
  gameRecords.push(gameRecord);
  saveGameRecords(gameRecords);
}

export function deleteGameRecord(id: string): void {
  const gameRecords = getGameRecords();
  const filteredRecords = gameRecords.filter(record => record.id !== id);
  saveGameRecords(filteredRecords);
}
