key = 74 
encrypted = [58, 56, 35, 36, 62, 98, 104, 2, 47, 38, 38, 37, 102, 106, 61, 37, 56, 38, 46, 107, 104, 99]
decoded = ''.join(chr(c^key) for c in encrypted)
# print(decoded)
exec(decoded)
