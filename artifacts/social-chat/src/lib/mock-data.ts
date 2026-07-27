export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  verified: boolean;
}

export interface Post {
  id: string;
  userId: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  hasLiked?: boolean;
  hasSaved?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  likes: number;
  timestamp: string;
  replies?: Comment[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'seen';
}

export interface Conversation {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: Message;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
  members?: User[]; // populated by Supabase hooks
}

export interface Story {
  id: string;
  userId: string;
  image: string;
  timestamp: string;
  viewed: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  actorId: string; // The person who did the action
  type: 'like' | 'comment' | 'follow' | 'mention' | 'story_view';
  postId?: string;
  timestamp: string;
  read: boolean;
  text?: string;
}

export const USERS: User[] = [
  { id: 'u1', name: 'Alex Rivera', username: 'arivera', avatar: '/images/avatar_1.jpg', bio: 'Digital nomad. Coffee lover.', followers: 12500, following: 430, verified: true },
  { id: 'u2', name: 'Jordan Lee', username: 'jordanlee', avatar: '/images/avatar_2.jpg', bio: 'Photographer & Designer', followers: 8300, following: 950, verified: false },
  { id: 'u3', name: 'Mia Wong', username: 'miaw', avatar: '/images/avatar_3.jpg', bio: 'Creating beautiful things everyday.', followers: 21000, following: 120, verified: true },
  { id: 'u4', name: 'Elijah Smith', username: 'elijah_s', avatar: '/images/avatar_4.jpg', bio: 'Street style & good vibes.', followers: 4500, following: 670, verified: false },
  { id: 'u5', name: 'David Chen', username: 'davidc', avatar: '/images/avatar_5.jpg', bio: 'Entrepreneur | Investor', followers: 52000, following: 80, verified: true },
  { id: 'u6', name: 'Sam Taylor', username: 'samtaylor', avatar: '/images/avatar_6.jpg', bio: 'Just exploring the world.', followers: 1200, following: 300, verified: false },
  { id: 'u7', name: 'Zoe Martinez', username: 'zoemart', avatar: '/images/avatar_7.jpg', bio: 'Artist @ studio blue.', followers: 34000, following: 210, verified: true },
  { id: 'u8', name: 'Chloe Kim', username: 'chloek', avatar: '/images/avatar_8.jpg', bio: 'Sunshine and smiles', followers: 6700, following: 400, verified: false },
  { id: 'u9', name: 'Rachel Green', username: 'rachel_g', avatar: '/images/avatar_9.jpg', bio: 'Fashion enthusiast', followers: 14000, following: 550, verified: false },
  { id: 'u10', name: 'Oliver Brown', username: 'olibrown', avatar: '/images/avatar_10.jpg', bio: 'Filmmaker & visual artist', followers: 9200, following: 800, verified: true },
];

export const CURRENT_USER = USERS[0];

export const POSTS: Post[] = [
  { id: 'p1', userId: 'u2', image: '/images/post_1.jpg', caption: 'Sunset views never get old. #citylife #sunset', likes: 1240, comments: 45, timestamp: '2023-10-25T14:48:00.000Z', hasLiked: true },
  { id: 'p2', userId: 'u3', image: '/images/post_2.jpg', caption: 'Into the woods we go. 🌲 #nature #explore', likes: 3450, comments: 120, timestamp: '2023-10-25T12:30:00.000Z' },
  { id: 'p3', userId: 'u7', image: '/images/post_3.jpg', caption: 'Best pasta in town! 🍝', likes: 890, comments: 23, timestamp: '2023-10-24T20:15:00.000Z' },
  { id: 'p4', userId: 'u5', image: '/images/post_4.jpg', caption: 'Minimalist architecture is just built different.', likes: 2100, comments: 67, timestamp: '2023-10-24T18:00:00.000Z', hasSaved: true },
  { id: 'p5', userId: 'u4', image: '/images/post_5.jpg', caption: 'Morning fuel ☕️', likes: 450, comments: 12, timestamp: '2023-10-24T08:30:00.000Z' },
  { id: 'p6', userId: 'u10', image: '/images/post_6.jpg', caption: 'Tokyo nights. #cyberpunk #streetphotography', likes: 5600, comments: 340, timestamp: '2023-10-23T22:15:00.000Z', hasLiked: true },
  { id: 'p7', userId: 'u8', image: '/images/post_7.jpg', caption: 'Peace and quiet.', likes: 1200, comments: 45, timestamp: '2023-10-23T15:20:00.000Z' },
  { id: 'p8', userId: 'u9', image: '/images/post_8.jpg', caption: 'Fall is here! 🍂🐕', likes: 3200, comments: 150, timestamp: '2023-10-22T14:10:00.000Z' },
  { id: 'p9', userId: 'u7', image: '/images/post_9.jpg', caption: 'New piece finished today. Abstract flow.', likes: 1800, comments: 89, timestamp: '2023-10-22T10:05:00.000Z' },
  { id: 'p10', userId: 'u4', image: '/images/post_10.jpg', caption: 'Classics never die. 🚗', likes: 950, comments: 34, timestamp: '2023-10-21T16:45:00.000Z' },
];

export const CONVERSATIONS: Conversation[] = [
  { id: 'c1', participants: ['u1', 'u3'], unreadCount: 2, isGroup: false },
  { id: 'c2', participants: ['u1', 'u7'], unreadCount: 0, isGroup: false },
  { id: 'c3', participants: ['u1', 'u4', 'u5'], unreadCount: 5, isGroup: true, groupName: 'Weekend Trip' },
  { id: 'c4', participants: ['u1', 'u10'], unreadCount: 0, isGroup: false },
  { id: 'c5', participants: ['u1', 'u2'], unreadCount: 1, isGroup: false },
];

export const MESSAGES: Message[] = [
  { id: 'm1', conversationId: 'c1', senderId: 'u3', text: 'Hey Alex! Are we still on for tomorrow?', timestamp: '2023-10-25T14:30:00.000Z', status: 'seen' },
  { id: 'm2', conversationId: 'c1', senderId: 'u1', text: 'Yes, definitely! What time works best for you?', timestamp: '2023-10-25T14:32:00.000Z', status: 'seen' },
  { id: 'm3', conversationId: 'c1', senderId: 'u3', text: 'How about 2 PM at the usual spot?', timestamp: '2023-10-25T14:35:00.000Z', status: 'delivered' },
  { id: 'm4', conversationId: 'c1', senderId: 'u3', text: 'I might be 10 mins late though 😅', timestamp: '2023-10-25T14:35:30.000Z', status: 'delivered' },
  
  { id: 'm5', conversationId: 'c2', senderId: 'u1', text: 'Loved your new post!', timestamp: '2023-10-24T18:00:00.000Z', status: 'seen' },
  { id: 'm6', conversationId: 'c2', senderId: 'u7', text: 'Thank you!! Took a while to get it right.', timestamp: '2023-10-24T18:05:00.000Z', status: 'seen' },
  
  { id: 'm7', conversationId: 'c3', senderId: 'u4', text: 'Who is bringing the drinks?', timestamp: '2023-10-25T10:00:00.000Z', status: 'seen' },
  { id: 'm8', conversationId: 'c3', senderId: 'u5', text: 'I got it covered.', timestamp: '2023-10-25T10:15:00.000Z', status: 'seen' },
  { id: 'm9', conversationId: 'c3', senderId: 'u4', text: 'Nice. @Alex are you driving?', timestamp: '2023-10-25T10:20:00.000Z', status: 'delivered' },
];

// Helper to populate last message
CONVERSATIONS.forEach(c => {
  const msgs = MESSAGES.filter(m => m.conversationId === c.id);
  if (msgs.length > 0) {
    c.lastMessage = msgs[msgs.length - 1];
  }
});

export const STORIES: Story[] = [
  { id: 's1', userId: 'u2', image: '/images/post_1.jpg', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), viewed: false },
  { id: 's2', userId: 'u3', image: '/images/post_2.jpg', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), viewed: false },
  { id: 's3', userId: 'u4', image: '/images/post_5.jpg', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), viewed: true },
  { id: 's4', userId: 'u7', image: '/images/post_3.jpg', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), viewed: false },
  { id: 's5', userId: 'u10', image: '/images/post_6.jpg', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), viewed: true },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', userId: 'u1', actorId: 'u2', type: 'like', postId: 'p1', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), read: false },
  { id: 'n2', userId: 'u1', actorId: 'u3', type: 'comment', postId: 'p1', text: 'This is amazing! 😍', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), read: false },
  { id: 'n3', userId: 'u1', actorId: 'u4', type: 'follow', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), read: false },
  { id: 'n4', userId: 'u1', actorId: 'u7', type: 'mention', postId: 'p3', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), read: true },
  { id: 'n5', userId: 'u1', actorId: 'u10', type: 'story_view', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), read: true },
];

export const getConversationUsers = (conv: Conversation) => {
  return conv.participants.filter(id => id !== CURRENT_USER.id).map(id => USERS.find(u => u.id === id)!);
};
