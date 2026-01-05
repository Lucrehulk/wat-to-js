const fs = require('fs');

let funcs = {};

function get_enclosed(line) {
    return [...line.matchAll(/\(([^()]+)\)/g)].map(i => i[1].trim().split(/\s+/));
};

function read_wat() {
    try {
        const filePath = "./txts/watfile.txt";
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        let watfile = fs.readFileSync(filePath, 'utf8').split("\n");
        for (let row in watfile) {
            let full_line = watfile[row].trim();
            if (!full_line || !full_line.includes("(func")) continue;

            let line = full_line.split(/\s+/);
            let funcName = line[1];

            if (!funcName || funcName.startsWith("(")) {
                funcName = `$func${row}`;
            }

            funcs[funcName] = {
                params: "",
                params_count: 0
            };

            let params_count = 0;
            let func_is_import = false;
            
            let nested_blocks = get_enclosed(full_line);

            for (let chunk of nested_blocks) {
                if (chunk[0] === "param") {
                    if (!func_is_import) {
                        for (let i = 1; i < chunk.length; i++) {
                            if (chunk[i].startsWith("$")) {
                                funcs[funcName].params += chunk[i] + ", ";
                                params_count++;
                            }
                        }
                    } else {
                        params_count += (chunk.length - 1);
                    }
                } else if (chunk[0] === "result") {
                    funcs[funcName].result = true;
                } else if (chunk[0] === "import") {
                    func_is_import = true;
                    funcs[funcName].import = true;
                }
            }

            funcs[funcName].params_count = params_count;
            if (funcs[funcName].params.endsWith(", ")) {
                funcs[funcName].params = funcs[funcName].params.slice(0, -2);
            }
        }
        console.log(funcs);
        fs.writeFileSync("./txts/func_definitions.txt", JSON.stringify(funcs, null, 2));
    } catch (error) {
        console.error(error.message);
        return null;
    }
};

read_wat();