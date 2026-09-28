import raw from "./source-data.json";
type SourceData={sourceId:string;sourceTitle:string;importedAt:string;items:{code:string;name:string;unit:string;category:string;note:string}[];history:any[]};
export default raw as SourceData;
