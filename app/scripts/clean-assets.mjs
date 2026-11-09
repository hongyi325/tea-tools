// 打包前刪除 repo 根目錄 assets/ 裡上一次打包留下的 index-*.js / index-*.css，
// 避免舊檔一直累積。只刪這兩種檔名，其他檔案不動。
import {readdirSync, rmSync, existsSync} from "node:fs";
import {fileURLToPath} from "node:url";

const dir = fileURLToPath(new URL("../../assets/", import.meta.url));
if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
        if (/^index-[\w-]+\.(js|css)$/.test(f)) {
            rmSync(dir + f);
            console.log("removed assets/" + f);
        }
    }
}
