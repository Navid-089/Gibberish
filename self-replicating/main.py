key = 74 
encrypted = [58, 56, 35, 36, 62, 98, 104, 2, 47, 38, 38, 37, 102, 106, 61, 37, 56, 38, 46, 107, 104, 99]
# Printing encrypted in ascii 

printable = ''.join(chr(c) if 32 <= c <= 126 else '.' for c in encrypted)
print(printable)

decoded = ''.join(chr(c^key) for c in encrypted)
# print(decoded)
exec(decoded)
