import fs from 'fs';
import path from 'path';
import { User, Room, Script, GameRecord } from '@/types';

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
