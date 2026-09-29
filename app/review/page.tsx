import {requireWarehouseUser} from "@/lib/auth-server";
import ReviewClient from "./review-client";
export const dynamic="force-dynamic";
export default async function ReviewPage(){const user=await requireWarehouseUser();return <ReviewClient role={user.role} displayName={user.displayName}/>;}
