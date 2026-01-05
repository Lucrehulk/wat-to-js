# wat-to-js
A tool that can parse non-folded, S-formatted WebAssembly text (WAT) (which most the commonly seen formatting of WAT, and if not in the form it can easily be formatted to by formatters) to JavaScript. Mainly built for reverse engineering.

How to use:
First, your wasm file needs to be in the correct format, since this is a string based parser. A good, reliable tool that works for this is https://webassembly.github.io/wabt/demo/wasm2wat/. It has multiple options. For enabled features, select the ones critical to your wasm file (also limit to v1.0 features, as this does not support features added outside of v1.0). Ensure "Generate Names" is enabled, "Fold Expressions" is disabled, and "Inline Export" is enabled (these ensure the correct formatting for the parser).

Since the parsing is string based, the parser can parse any segment of WebAssembly code given to it--obviously it will fail to accurately parse certain things if certain definitions (funcs, blocks/loops, values on stack etc.) that are not given are utilized in the segment given, but it allows for flexibility with the segments you wish to parse.

If the segment you're attempting to parse has a func in it (call or declaration, this is not necessary for indirect calls), then you should first use the code provided in func_definitions_builder.js. This code outputs outputs a JSON stringified object of function definition data to the func_definitions.txt that the parser uses in order to effectively handle functions. Just make sure you have input your watfile (or really only the necessary segments of it, but it's easier to just input the whole thing) intp the watfile.txt, and run the builder. If the segment you're attempting to parse does not have a func in it, then this step is not necessary.

After ensuring you have set the target WAT segment to parse in the wat_segment_to_parse.txt, simply run the converter.js file in order to recieve an output of JS in result.txt.

Note that I made this tool for my own personal use, and did not extremely thoroughly test it. For my own reverse engineering endeavors it worked quite well, but I can almost guarantuee that there may be a few bugs within this parser. Use with caution.
