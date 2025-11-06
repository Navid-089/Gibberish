#!/usr/bin/env python3
"""
Password Generator for Dictionary Attack Testing
Generates various types of passwords for testing attack effectiveness
"""

import random
import string
from typing import List


class PasswordGenerator:
    """Generate different types of passwords for testing"""
    
    def __init__(self):
        self.common_words = [
            'password', 'admin', 'user', 'guest', 'root', 'test', 'demo',
            'welcome', 'login', 'secret', 'private', 'public', 'temp',
            'default', 'system', 'manager', 'office', 'company', 'service'
        ]
        
        self.names = [
            'john', 'mary', 'david', 'sarah', 'michael', 'jessica', 'james',
            'emily', 'robert', 'lisa', 'william', 'jennifer', 'richard', 'karen'
        ]
        
        self.years = list(range(1980, 2026))
        self.months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
        
    def generate_weak_passwords(self, count: int = 10) -> List[str]:
        """Generate weak, easily crackable passwords"""
        weak_passwords = []
        
        # Dictionary words with simple modifications
        for _ in range(count // 3):
            word = random.choice(self.common_words)
            variations = [
                word,
                word.capitalize(),
                word + '123',
                word + '1',
                word + '!',
                '123' + word,
                word + str(random.randint(1, 99))
            ]
            weak_passwords.append(random.choice(variations))
        
        # Simple numeric passwords
        for _ in range(count // 3):
            length = random.randint(4, 8)
            numeric_password = ''.join([str(random.randint(0, 9)) for _ in range(length)])
            weak_passwords.append(numeric_password)
        
        # Common patterns
        patterns = ['qwerty', 'asdfgh', 'zxcvbn', '111111', '000000', 'aaaaaa']
        for _ in range(count - len(weak_passwords)):
            weak_passwords.append(random.choice(patterns))
        
        return weak_passwords[:count]
    
    def generate_medium_passwords(self, count: int = 10) -> List[str]:
        """Generate medium strength passwords"""
        medium_passwords = []
        
        for _ in range(count):
            # Combine word + number + symbol
            word = random.choice(self.common_words + self.names)
            number = str(random.randint(10, 9999))
            symbol = random.choice('!@#$%&*')
            
            patterns = [
                word.capitalize() + number + symbol,
                word.upper() + number,
                word + number + word[:2],
                symbol + word + number,
                word + str(random.choice(self.years))
            ]
            
            medium_passwords.append(random.choice(patterns))
        
        return medium_passwords
    
    def generate_strong_passwords(self, count: int = 10, length: int = 12) -> List[str]:
        """Generate strong, complex passwords"""
        strong_passwords = []
        
        for _ in range(count):
            # Mix of all character types
            chars = (string.ascii_lowercase + string.ascii_uppercase + 
                    string.digits + '!@#$%^&*()_+-=[]{}|;:,.<>?')
            
            password = ''.join(random.choice(chars) for _ in range(length))
            strong_passwords.append(password)
        
        return strong_passwords
    
    def generate_passphrase_style(self, count: int = 10) -> List[str]:
        """Generate passphrase-style passwords"""
        words_list = [
            'correct', 'horse', 'battery', 'staple', 'mountain', 'river', 'ocean',
            'forest', 'garden', 'window', 'keyboard', 'monitor', 'coffee', 'table',
            'chair', 'book', 'paper', 'pencil', 'mouse', 'phone', 'camera', 'music'
        ]
        
        passphrases = []
        for _ in range(count):
            # 3-4 words with separators
            word_count = random.randint(3, 4)
            words = random.sample(words_list, word_count)
            
            # Random capitalization
            words = [word.capitalize() if random.random() > 0.5 else word for word in words]
            
            # Random separators
            separators = ['-', '_', '.', ' ']
            separator = random.choice(separators)
            
            passphrase = separator.join(words)
            
            # Sometimes add numbers
            if random.random() > 0.5:
                passphrase += str(random.randint(1, 999))
            
            passphrases.append(passphrase)
        
        return passphrases
    
    def generate_all_types(self) -> dict:
        """Generate a comprehensive set of password types"""
        return {
            'weak': self.generate_weak_passwords(15),
            'medium': self.generate_medium_passwords(10),
            'strong': self.generate_strong_passwords(8),
            'passphrase': self.generate_passphrase_style(5)
        }


def main():
    """Demo the password generator"""
    generator = PasswordGenerator()
    
    print("Password Generator Demo")
    print("=" * 40)
    
    all_passwords = generator.generate_all_types()
    
    for category, passwords in all_passwords.items():
        print(f"\n{category.upper()} PASSWORDS:")
        for i, password in enumerate(passwords, 1):
            print(f"  {i:2d}. {password}")
    
    # Save to file for testing
    output_file = "/media/askeladd/32B07941B0790D1B1/Gibberish/Dictionary-attack/test_passwords.txt"
    with open(output_file, 'w') as f:
        for category, passwords in all_passwords.items():
            f.write(f"# {category.upper()} PASSWORDS\n")
            for password in passwords:
                f.write(f"{password}\n")
            f.write("\n")
    
    print(f"\nTest passwords saved to: {output_file}")


if __name__ == "__main__":
    main()