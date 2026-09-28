import { requireWarehouseUser } from '@/lib/auth-server';
import InventoryApp from './application';
export const dynamic = 'force-dynamic';
export default async function Home() { await requireWarehouseUser(); return <InventoryApp/>; }
