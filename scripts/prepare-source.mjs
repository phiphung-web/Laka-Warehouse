import {copyFileSync,constants,existsSync} from "node:fs";
const target=new URL("../lib/source-data.json",import.meta.url);
if(!existsSync(target))copyFileSync(new URL("../lib/source-data.example.json",import.meta.url),target,constants.COPYFILE_EXCL);
