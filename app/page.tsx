import { requireWarehouseUser } from '@/lib/auth-server';
import {redirect} from 'next/navigation';
import InventoryApp from './application';
export const dynamic = 'force-dynamic';
export default async function Home() { const user=await requireWarehouseUser();if(user.role==='viewer')redirect('/review'); return <InventoryApp/>; }
