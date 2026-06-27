import {Collection , ObjectId} from 'mongodb';
import {getDb} from '../config/db';


export interface UserDocument {
   id?:ObjectId;
   atlassianId:string;
   email?:string;
   displayName?: string; 
   plan:'free' | 'pro';
   plan_expires_at?:Date;
   paddle_customer_id?:string;
   paddle_subscription_id?:string;
   created_at:Date;
   updated_at:Date;
}


//Collection accessor
export async function getUsersCollection(): Promise<Collection<UserDocument>> {
     const db = await getDb();
     return db.collection<UserDocument>('users');
}


export async function createUserIndexes(): Promise<void>{
    const col = await getUsersCollection();
    await col.createIndex({atlassianId:1},{unique:true});
    await col.createIndex({paddle_customer_id:1});
}