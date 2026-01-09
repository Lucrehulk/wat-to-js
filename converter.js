const fs = require('fs');

let func_definitions = JSON.parse(fs.readFileSync("./txts/func_definitions.txt", 'utf8'));
let lines = fs.readFileSync("./txts/wat_segment_to_parse.txt", 'utf8');

lines = lines.split("\n");
let out = "";
let stack = [];
let params;
let enclosed;
let offset;
let address;
let address_set; 
let if_branch_copy_stack;
let values = {};
let branch_result_count = 0;
let holder_count = 0;
let line_count = 0;
let branch_stack = [];
let holders_data = [];
let func_returns;

let label_counter = 0;

function use_stack(count) {
    let items = [];
    for (let i = 0; i < count; i++) {
        if (stack.length) {
            items.push(stack.pop());
        } else {
            items.push("NO_ITEM_ON_STACK");
        }
    }
    return items;
};

function add_line(line) {
    out += line + "\n";
    line_count++;
    for (let holder = 0; holder < holder_count; holder++) {
        if (new RegExp(`\\$holder${holder}(?!\\d)`).test(line)) {
            holders_data[holder].used = true;
        }
    }
};

function add_result_line() {
    let result_name = `$result${branch_result_count++}`;
    return result_name;
};

function add_holder_line(set) {
    out += `let $holder${holder_count} = ${set}\n`;
    line_count++;
    return `$holder${holder_count++}`;
};

function get_enclosed(line) {
    return [...line.matchAll(/\((.*?)\)/g)].map(i => i[1].split(" "));
};

function find_parameter(line, target) {
    for (let i = 1; i < line.length; i++) {
        let params = line[i].split("=");
        if (params[0] == target) return params[1];
    };
    return "";
};

function replace(line, item, replacement) {
    let escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex = new RegExp(`(?<=(^|\\W|\\())${escaped}(?=(\\W|$|\\)))`, 'g');
    return line.toString().replace(regex, (match, ...args) => {
        return replacement;
    });
};

function find_branch_target(label) {
    if (!isNaN(parseInt(label))) {
        let depth = parseInt(label);
        if (depth >= branch_stack.length) throw Error(`Invalid branch depth: ${depth}`);
        return branch_stack[branch_stack.length - 1 - depth];
    }
    for (let i = branch_stack.length - 1; i >= 0; i--) {
        if (branch_stack[i].name === label) return branch_stack[i];
    }
    throw Error(`Branch label not found: ${label}`);
}

for (let row in lines) {
    let full_line = lines[row].trim();
    if (!full_line) continue;
    let line = full_line.split(" ");
    let header = line[0].split(".");
    switch (header[0]) {
        case "i32":
        case "i64":
        case "f32":
        case "f64":
            let type = header[0];
            switch (header[1]) {
                case "const":
                    stack.push(parseFloat(line[1]));
                    break;
                case "add":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(${params[1]}) + BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} + ${params[0]}) | 0)`);
                    }
                    break;
                case "sub":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(${params[1]}) - BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} - ${params[0]}) | 0)`);
                    }
                    break;
                case "mul":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(${params[1]}) * BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} * ${params[0]}) | 0)`);
                    }
                    break;
                case "div_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(${params[1]}) / BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} / ${params[0]}) | 0)`);
                    }
                    break;
                case "rem_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(${params[1]}) % BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} % ${params[0]}) | 0)`);
                    }
                    break;
                case "rem_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`BigInt.asUintN(64, BigInt(${params[1]}) % BigInt(${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} >>> 0) % (${params[0]} >>> 0)) >>> 0`);
                    }
                    break;
                case "and":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) & BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} & ${params[0]})`);
                    }
                    break;
                case "or":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) | BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} | ${params[0]})`);
                    }
                    break;
                case "xor":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) ^ BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} ^ ${params[0]})`);
                    }
                    break;
                case "shl":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) << BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} << ${params[0]})`);
                    }
                    break;
                case "shr_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asIntN(64, ${params[1]}) >> BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} >> ${params[0]})`);
                    }
                    break;
                case "shr_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asUintN(64, ${params[1]}) >> BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} >>> ${params[0]})`);
                    }
                    break;
                case "rotl":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(((BigInt(${params[1]}) << (BigInt(${params[0]}) % 64n)) | (BigInt(${params[1]}) >> ((64n - (BigInt(${params[0]}) % 64n)) % 64n))) & ((1n << 64n) - 1n))`);
                    } else {
                        stack.push(`(((${params[1]} >>> 0) << (${params[0]} & 31)) | ((${params[1]} >>> 0) >>> (32 - (${params[0]} & 31)))) >>> 0`);
                    }
                    break;
                case "rotr":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(((BigInt(${params[1]}) >> (BigInt(${params[0]}) % 64n)) | (BigInt(${params[1]}) << ((64n - (BigInt(${params[0]}) % 64n)) % 64n))) & ((1n << 64n) - 1n))`);
                    } else {
                        stack.push(`(((${params[1]} >>> 0) >>> (${params[0]} & 31)) | ((${params[1]} >>> 0) << (32 - (${params[0]} & 31)))) >>> 0`);
                    }
                    break;
                case "clz":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[0]}) == 0n ? 64 : 64 - BigInt(${params[0]}).toString(2).length)`);
                    } else {
                        stack.push(`Math.clz32(${params[0]})`);
                    }
                    break;
                case "ctz":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[0]}) == 0n ? 64 : BigInt(${params[0]}).toString(2).split("").reverse().join("").indexOf("1"))`);
                    } else {
                        stack.push(`(${params[0]} == 0 ? 32 : 31 - Math.clz32(${params[0]} & -${params[0]}))`);
                    }
                    break;
                case "eqz":
                    params = use_stack(1);
                    stack.push(`${params[0]} == 0`);
                    break;
                case "eq":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) == BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} == ${params[0]})`);
                    }
                    break;
                case "ne":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[1]}) !== BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} !== ${params[0]})`);
                    }
                    break;
                case "lt_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asIntN(64, ${params[1]}) < BigInt.asIntN(64, ${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} < ${params[0]})`);
                    }
                    break;
                case "lt_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asUintN(64, ${params[1]}) < BigInt.asUintN(64, ${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} >>> 0) < (${params[0]} >>> 0))`);
                    }
                    break;
                case "gt_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asIntN(64, ${params[1]}) > BigInt.asIntN(64, ${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} > ${params[0]})`);
                    }
                    break;
                case "gt_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asUintN(64, ${params[1]}) > BigInt.asUintN(64, ${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} >>> 0) > (${params[0]} >>> 0))`);
                    }
                    break;
                case "le_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asIntN(64, ${params[1]}) <= BigInt.asIntN(64, ${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} <= ${params[0]})`);
                    }
                    break;
                case "le_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asUintN(64, ${params[1]}) <= BigInt.asUintN(64, ${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} >>> 0) <= (${params[0]} >>> 0))`);
                    }
                    break;
                case "ge_s":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asIntN(64, ${params[1]}) >= BigInt.asIntN(64, ${params[0]}))`);
                    } else {
                        stack.push(`(${params[1]} >= ${params[0]})`);
                    }
                    break;
                case "ge_u":
                    params = use_stack(2);
                    if (type == "i64") {
                        stack.push(`(BigInt.asUintN(64, ${params[1]}) >= BigInt.asUintN(64, ${params[0]}))`);
                    } else {
                        stack.push(`((${params[1]} >>> 0) >= (${params[0]} >>> 0))`);
                    }
                    break;
                case "popcnt":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[0]}).toString(2).replace(/0/g, "").length)`);
                    } else {
                        stack.push(`(${params[0]}.toString(2).replace(/0/g, "").length)`);
                    }
                    break;
                case "abs":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`(BigInt(${params[0]}) < 0n ? -BigInt(${params[0]}) : BigInt(${params[0]}))`);
                    } else {
                        stack.push(`Math.abs(${params[0]})`);
                    }
                    break;
                case "neg":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`(-BigInt(${params[0]}))`);
                    } else {
                        stack.push(`(-${params[0]})`);
                    }
                    break;
                case "sqrt":
                    params = use_stack(1);
                    stack.push(`Math.sqrt(${params[0]})`);
                    break;
                case "ceil":
                    params = use_stack(1);
                    stack.push(`Math.ceil(${params[0]})`);
                    break;
                case "floor":
                    params = use_stack(1);
                    stack.push(`Math.floor(${params[0]})`);
                    break;
                case "trunc":
                    params = use_stack(1);
                    stack.push(`Math.trunc(${params[0]})`);
                    break;
                case "nearest":
                    params = use_stack(1);
                    stack.push(`Math.round(${params[0]})`);
                    break;
                case "min":
                    params = use_stack(2);
                    stack.push(`Math.min(${params[1]}, ${params[0]})`);
                    break;
                case "max":
                    params = use_stack(2);
                    stack.push(`Math.max(${params[1]}, ${params[0]})`);
                    break;
                case "copysign":
                    params = use_stack(2);
                    stack.push(`Math.abs(${params[1]}) * Math.sign(${params[0]})`);
                    break;
                case "wrap_i64":
                    params = use_stack(1);
                    stack.push(`(${params[0]} & 4294967295)`);
                    break;
                case "extend_i32_s":
                    params = use_stack(1);
                    stack.push(`BigInt.asIntN(64, BigInt(${params[0]}))`);
                    break;
                case "extend_i32_u":
                    params = use_stack(1);
                    stack.push(`BigInt.asUintN(64, BigInt(${params[0]}))`);
                    break;
                case "trunc_f32_s":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(Math.trunc(${params[0]})))`);
                    } else {
                        stack.push(`Math.trunc(${params[0]}) | 0`);
                    }
                    break;
                case "trunc_f64_s":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`BigInt.asIntN(64, BigInt(Math.trunc(${params[0]})))`);
                    } else {
                        stack.push(`Math.trunc(${params[0]}) | 0`);
                    }
                    break;
                case "trunc_f32_u":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`BigInt.asUintN(64, BigInt(Math.trunc(${params[0]})))`);
                    } else {
                        stack.push(`Math.trunc(${params[0]}) >>> 0`);
                    }
                    break;
                case "trunc_f64_u":
                    params = use_stack(1);
                    if (type == "i64") {
                        stack.push(`BigInt.asUintN(64, BigInt(Math.trunc(${params[0]})))`);
                    } else {
                        stack.push(`Math.trunc(${params[0]}) >>> 0`);
                    }
                    break;
                case "reinterpret_i32":
                    params = use_stack(1);
                    stack.push(`new Float32Array(new Int32Array([${params[0]}]).buffer)[0]`);
                    break;
                case "reinterpret_i64":
                    params = use_stack(1);
                    stack.push(`new Float64Array(new BigInt64Array([${params[0]}]).buffer)[0]`);
                    break;
                case "reinterpret_f32":
                    params = use_stack(1);
                    stack.push(`new Int32Array(new Float32Array([${params[0]}]).buffer)[0]`);
                    break;
                case "reinterpret_f64":
                    params = use_stack(1);
                    stack.push(`new BigInt64Array(new Float64Array([${params[0]}]).buffer)[0]`);
                    break;
                case "convert_i32_s":
                    params = use_stack(1);
                    if (type == "f32") {
                        stack.push(`Math.fround(${params[0]} | 0)`);
                    } else if (type == "f64") {
                        stack.push(`Number(${params[0]} | 0)`);
                    }
                    break;
                case "convert_i32_u":
                    params = use_stack(1);
                    if (type == "f32") {
                        stack.push(`Math.fround(${params[0]} >>> 0)`);
                    } else if (type == "f64") {
                        stack.push(`Number(${params[0]} >>> 0)`);
                    }
                    break;
                case "convert_i64_s":
                    params = use_stack(1);
                    if (type == "f32") {
                        stack.push(`Math.fround(Number(BigInt.asIntN(64, ${params[0]})))`);
                    } else if (type == "f64") {
                        stack.push(`Number(BigInt.asIntN(64, ${params[0]}))`);
                    }
                    break;
                case "convert_i64_u":
                    params = use_stack(1);
                    if (type == "f32") {
                        stack.push(`Math.fround(Number(BigInt.asUintN(64, ${params[0]})))`);
                    } else if (type == "f64") {
                        stack.push(`Number(BigInt.asUintN(64, ${params[0]}))`);
                    }
                    break;
                case "promote_f32":
                    params = use_stack(1);
                    stack.push(`new Float64Array(new Float32Array([${params[0]}]).buffer)[0]`);
                    break;
                case "demote_f64":
                    params = use_stack(1);
                    stack.push(`Math.fround(${params[0]})`);
                    break;
                case "load":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`${type}[(${params[0]}${offset == "" ? "" : ` + ${offset}`}) / ${parseInt(type.slice(1, 3)) / 8}]`);
                    break;
                case "load8_s":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`i8[(${params[0]}${offset == "" ? "" : ` + ${offset}`})]`);
                    break;
                case "load8_u":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`u8[(${params[0]}${offset == "" ? "" : ` + ${offset}`})]`);
                    break;
                case "load16_s":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`i16[(${params[0]}${offset == "" ? "" : ` + ${offset}`}) / 2]`);
                    break;
                case "load16_u":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`u16[(${params[0]}${offset == "" ? "" : ` + ${offset}`}) / 2]`);
                    break;
                case "load32_s":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`i32[(${params[0]}${offset == "" ? "" : ` + ${offset}`}) / 4]`);
                    break;
                case "load32_u":
                    params = use_stack(1);
                    offset = find_parameter(line, "offset");
                    stack.push(`u32[(${params[0]}${offset == "" ? "" : ` + ${offset}`}) / 4]`);
                    break;
                case "store":
                    offset = find_parameter(line, "offset");
                    params = use_stack(2);
                    address = `${type}[${`(${params[1]}${offset == "" ? "" : ` + ${offset}`}) / ${parseInt(type.slice(1, 3)) / 8}`}]`;
                    address_set = `${(type == "i64") ? `BigInt(${params[0]})` : params[0]}`;
                    if (values[address]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(address);
                        for (let item in stack) stack[item] = replace(stack[item], address, holder_value);
                        for (let item in values) values[item] = replace(values[item], address, holder_value);
                        values[address] = replace(address_set, address, holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], address, address + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], address, address + "_REWRITTEN");
                        values[address] = replace(address_set, address, address + "_REWRITTEN");
                    }
                    add_line(`${address} = ${address_set};`);
                    break;
                case "store8":
                    offset = find_parameter(line, "offset");
                    params = use_stack(2);
                    address = `u8[${`(${params[1]}${offset == "" ? "" : ` + ${offset}`})`}]`;
                    address_set = `${(type == "i64") ? `BigInt(${params[0]})` : params[0]}`;
                    if (values[address]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(address);
                        for (let item in stack) stack[item] = replace(stack[item], address, holder_value);
                        for (let item in values) values[item] = replace(values[item], address, holder_value);
                        values[address] = replace(address_set, address, holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], address, address + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], address, address + "_REWRITTEN");
                        values[address] = replace(address_set, address, address + "_REWRITTEN");
                    }
                    add_line(`${address} = ${address_set};`);
                    break;
                case "store16":
                    offset = find_parameter(line, "offset");
                    params = use_stack(2);
                    address = `u16[${`(${params[1]}${offset == "" ? "" : ` + ${offset}`}) / 2`}]`;
                    address_set = `${(type == "i64") ? `BigInt(${params[0]})` : params[0]}`;
                    if (values[address]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(address);
                        for (let item in stack) stack[item] = replace(stack[item], address, holder_value);
                        for (let item in values) values[item] = replace(values[item], address, holder_value);
                        values[address] = replace(address_set, address, holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], address, address + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], address, address + "_REWRITTEN");
                        values[address] = replace(address_set, address, address + "_REWRITTEN");
                    }
                    add_line(`${address} = ${address_set};`);
                    break;
                case "store32":
                    offset = find_parameter(line, "offset");
                    params = use_stack(2);
                    address = `u32[${`(${params[1]}${offset == "" ? "" : ` + ${offset}`}) / 4`}]`;
                    address_set = `${(type == "i64") ? `BigInt(${params[0]})` : params[0]}`;
                    if (values[address]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(address);
                        for (let item in stack) stack[item] = replace(stack[item], address, holder_value);
                        for (let item in values) values[item] = replace(values[item], address, holder_value);
                        values[address] = replace(address_set, address, holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], address, address + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], address, address + "_REWRITTEN");
                        values[address] = replace(address_set, address, address + "_REWRITTEN");
                    }
                    add_line(`${address} = ${address_set};`);
                    break;
            }
            break;
        case "select":
            params = use_stack(3);
            stack.push(`(${params[0]} ? ${params[2]} : ${params[1]})`);
            break;
        case "local":
        case "global":
            switch (header[1]) {
                case "get":
                    stack.push(line[1]);
                    break;
                case "set":
                    params = use_stack(1);
                    if (values[line[1]]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(line[1]);
                        for (let item in stack) stack[item] = replace(stack[item], line[1], holder_value);
                        for (let item in values) values[item] = replace(values[item], line[1], holder_value);
                        values[line[1]] = replace(params[0], line[1], holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], line[1], line[1] + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], line[1], line[1] + "_REWRITTEN");
                        values[line[1]] = replace(params[0], line[1], line[1] + "_REWRITTEN");
                    }
                    add_line(`${line[1]} = ${params[0]};`);
                    break;
                case "tee":
                    params = use_stack(1);
                    if (values[line[1]]) {
                        holders_data.push({
                            line: line_count,
                            used: false
                        });
                        let holder_value = add_holder_line(line[1]);
                        for (let item in stack) stack[item] = replace(stack[item], line[1], holder_value);
                        for (let item in values) values[item] = replace(values[item], line[1], holder_value);
                        values[line[1]] = replace(params[0], line[1], holder_value);
                    } else {
                        for (let item in stack) stack[item] = replace(stack[item], line[1], line[1] + "_REWRITTEN");
                        for (let item in values) values[item] = replace(values[item], line[1], line[1] + "_REWRITTEN");
                        values[line[1]] = replace(params[0], line[1], line[1] + "_REWRITTEN");
                    }
                    add_line(`${line[1]} = ${params[0]};`);
                    stack.push(line[1]);
                    break;
            }
            break;
        case "if":
            params = use_stack(1);
            if_branch_copy_stack = [...stack];
            enclosed = get_enclosed(full_line);
            let if_js_label = `$B_${label_counter++}`;
            let if_result_var = null;
            if (enclosed.length > 0 && enclosed[0][0] === "result") {
                if_result_var = add_result_line();
            }
            branch_stack.push({
                type: "if",
                name: null,
                js_label: if_js_label,
                result_var: if_result_var,
                line: row
            });
            add_line(`if (${params[0]}) {`);
            break;
        case "else":
            let current_branch = branch_stack[branch_stack.length - 1];
            if (current_branch.result_var) {
                add_line(`${current_branch.result_var} = ${stack[stack.length - 1]};`);
            }
            add_line(`} else {`);
            stack = [...if_branch_copy_stack];
            break;
        case "end":
            let exited_branch = branch_stack.pop();
            if (exited_branch) {
                if (exited_branch.result_var && stack.length > 0) {
                     add_line(`${exited_branch.result_var} = ${stack[stack.length - 1]};`);
                     stack[stack.length - 1] = exited_branch.result_var; 
                }
                if (exited_branch.type === "if" && branch_stack.length > 0) {
                    let parent = branch_stack[branch_stack.length - 1];
                    if (parent.type === "loop") {
                        add_line("} else { break " + parent.js_label + ";");
                    }
                }
            }
            add_line("}");
            break;
        case "block":
            enclosed = get_enclosed(full_line);
            let block_name = line[1] && line[1].startsWith("$") ? line[1] : null;
            let block_js_label = `$B_${label_counter++}`;
            let block_result = null;
            if (full_line.includes("(result")) {
                block_result = add_result_line();
            }
            branch_stack.push({
                type: "block",
                name: block_name,
                js_label: block_js_label,
                result_var: block_result,
                line: row
            });
            add_line(`${block_js_label}: {`);
            break;
        case "loop":
            enclosed = get_enclosed(full_line);
            let loop_name = line[1] && line[1].startsWith("$") ? line[1] : null;
            let loop_js_label = `$L_${label_counter++}`;
            let loop_result = null;
            if (full_line.includes("(result")) {
                loop_result = add_result_line();
            }
            branch_stack.push({
                type: "loop",
                name: loop_name,
                js_label: loop_js_label,
                result_var: loop_result,
                line: row
            });
            add_line(`${loop_js_label}: while (true) {`);
            break;
        case "br":
            {
                let target = find_branch_target(line[1]);
                if (target.result_var) {
                    add_line(`${target.result_var} = ${stack[stack.length - 1]};`);
                }
                if (target.type === "loop") {
                    add_line(`continue ${target.js_label};`);
                } else {
                    add_line(`break ${target.js_label};`);
                }
            }
            break;
        case "br_if":
            {
                params = use_stack(1);
                let target = find_branch_target(line[1]);
                add_line(`if (${params[0]}) {`);
                if (target.result_var) {
                    add_line(`${target.result_var} = ${stack[stack.length - 1]};`);
                }
                if (target.type === "loop") {
                    add_line(`continue ${target.js_label};`);
                } else {
                    add_line(`break ${target.js_label};`);
                }
                add_line(`}`);
            }
            break;
        case "br_table":
            params = use_stack(1);
            add_line(`switch (${params[0]}) {`);
            let table_targets = line.slice(1);
            let default_target_label = table_targets.pop();
            table_targets.forEach((tgt, index) => {
                add_line(`case ${index}:`);
                let target = find_branch_target(tgt);
                if (target.result_var) add_line(`${target.result_var} = ${stack[stack.length - 1]};`);
                add_line(target.type === "loop" ? `continue ${target.js_label};` : `break ${target.js_label};`);
            });
            add_line(`default:`);
            {
                let target = find_branch_target(default_target_label);
                if (target.result_var) add_line(`${target.result_var} = ${stack[stack.length - 1]};`);
                add_line(target.type === "loop" ? `continue ${target.js_label};` : `break ${target.js_label};`);
            }
            add_line(`}`);
            break;
        case "call":
            let func = func_definitions[line[1]];
            if (!func) throw Error("FUNCTION CALLED BUT NOT DEFINED IN FUNCTION DEFINITIONS. CANNOT CONTINUE.");
            params = use_stack(func.params_count);
            let parameters = "";
            for (let index = params.length - 1; index > 0; index--) parameters += params[index] + ", ";
            parameters += params[0];
            if (func.result) {
                let result = branch_result_count++;
                add_line(`let $result${result} = ${line[1]}(${parameters});`);
                stack.push(`$result${result}`);
            } else {
                add_line(`${line[1]}(${parameters});`);
            }
            break;
        case "call_indirect":
            let indirect_params_count = 0;
            let indirect_has_result = false;
            enclosed = get_enclosed(full_line);
            for (let entry in enclosed) {
                if (enclosed[entry][0] == "param") {
                    indirect_params_count = enclosed[entry].length - 1;
                } else if (enclosed[entry][0] == "result") {
                    indirect_has_result = true;
                }
            }
            params = use_stack(indirect_params_count + 1);
            let indirect_parameters = "";
            for (let index = params.length - 1; index > 1; index--) indirect_parameters += params[index] + ", ";
            indirect_parameters += params[1];
            if (indirect_has_result) {
                let result = branch_result_count++;
                add_line(`let $result${result} = func_table[${params[0]}](${indirect_parameters});`);
                stack.push(`$result${result}`);
            } else {
                add_line(`func_table[${params[0]}](${indirect_parameters});`);
            }
            break;
        case "(local":
            enclosed = get_enclosed(full_line);
            for (let local in enclosed) add_line(`let ${enclosed[local][1]} = 0;`);
            break;
        case "(func":
            let func_data = func_definitions[line[1]];
            if (!func_data) throw Error("FUNCTION DECLARED BUT NOT DEFINED IN FUNCTION DEFINITIONS. CANNOT CONTINUE.");
            add_line(`function ${line[1]}(${func_data.params}) {`);
            if (func_data.result) {
                func_returns = true;
                add_line("let $result;");
            }
            break;
        case "memory":
            switch (header[1]) {
                case "size":
                    stack.push("// SIZEOF MEMORY");
                    break;
                case "grow":
                    params = use_stack(1);
                    add_line(`// GROW MEMORY BY ${params[0]} PAGES`);
                    break;
                case "copy":
                    params = use_stack(3);
                    add_line(`// MEMORY COPIED ${params[0]} BYTES FROM ${params[1]} TO ${params[2]}`);
                    break;
                case "fill":
                    params = use_stack(3);
                    add_line(`// MEMORY FILLED ${params[0]} BYTES AT ${params[2]} WITH ${params[1]}`);
                    break;
            }
            break;
        case "return":
            if (func_returns) {
                params = use_stack(1);
                add_line(`return ${params[0]};`);
            } else {
                add_line(`return;`);
            }
            break;
        case ")":
            if (func_returns && stack.length > 0) {
                params = use_stack(1);
                add_line(`return ${params[0]};`);
            }
            add_line("}");
            break;
        case "unreachable":
            add_line(`throw Error("unreachable");`);
            break;
        case "drop":
            stack.pop();
    }
}

let out_lines = out.split("\n");
for (let holder = holders_data.length - 1; holder > -1; holder--) {
    if (!holders_data[holder].used) {
        out_lines.splice(holders_data[holder].line, 1);
    }
}
out = out_lines.join("\n");

console.log(out, stack);
fs.writeFileSync("./txts/result.txt", out);
