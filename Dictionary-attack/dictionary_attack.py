#!/usr/bin/env python3
"""
Dictionary Attack Simulation
A comprehensive simulation of dictionary-based password attacks
"""

import hashlib
import time
import random
import string
from typing import List, Dict, Tuple, Optional
import itertools
import os
from collections import Counter


class PasswordHasher:
    """Class to handle password hashing using various algorithms"""
    
    @staticmethod
    def hash_password(password: str, algorithm: str = 'sha256', salt: str = '') -> str:
        """Hash a password using specified algorithm"""
        full_password = salt + password
        
        if algorithm == 'md5':
            return hashlib.md5(full_password.encode()).hexdigest()
        elif algorithm == 'sha1':
            return hashlib.sha1(full_password.encode()).hexdigest()
        elif algorithm == 'sha256':
            return hashlib.sha256(full_password.encode()).hexdigest()
        elif algorithm == 'sha512':
            return hashlib.sha512(full_password.encode()).hexdigest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")


class DictionaryAttack:
    """Main class for dictionary attack simulation"""
    
    def __init__(self, hash_algorithm: str = 'sha256', salt: str = ''):
        self.hash_algorithm = hash_algorithm
        self.salt = salt
        self.hasher = PasswordHasher()
        self.attempts = 0
        self.start_time = None
        self.found_passwords = {}
        
    def load_dictionary(self, dictionary_path: str) -> List[str]:
        """Load dictionary from file"""
        try:
            with open(dictionary_path, 'r', encoding='utf-8', errors='ignore') as f:
                return [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            print(f"Dictionary file {dictionary_path} not found")
            return []
    
    def generate_common_passwords(self) -> List[str]:
        """Generate a list of common passwords for testing"""
        common_passwords = [
            'password', '123456', 'password123', 'admin', 'qwerty',
            'letmein', 'welcome', 'monkey', '1234567890', 'abc123',
            'Password1', 'superman', 'iloveyou', 'trustno1', 'dragon',
            'baseball', 'football', 'master', 'michael', 'jordan',
            'sunshine', 'shadow', 'computer', 'internet', 'secret',
            'orange', 'starwars', 'chocolate', 'test123', 'guest'
        ]
        
        # Add variations with numbers and special characters
        variations = []
        for pwd in common_passwords:
            variations.extend([
                pwd + '1', pwd + '123', pwd + '!',
                pwd.upper(), pwd.lower(), pwd.capitalize()
            ])
        
        return common_passwords + variations
    
    def generate_target_hashes(self, passwords: List[str]) -> Dict[str, str]:
        """Generate target password hashes for attack simulation"""
        target_hashes = {}
        for password in passwords:
            hash_value = self.hasher.hash_password(password, self.hash_algorithm, self.salt)
            target_hashes[hash_value] = password
        return target_hashes
    
    def attack_single_hash(self, target_hash: str, dictionary: List[str]) -> Optional[str]:
        """Attempt to crack a single hash using dictionary"""
        self.attempts = 0
        self.start_time = time.time()
        
        print(f"Attacking hash: {target_hash[:16]}...")
        
        for password in dictionary:
            self.attempts += 1
            computed_hash = self.hasher.hash_password(password, self.hash_algorithm, self.salt)
            
            if computed_hash == target_hash:
                elapsed_time = time.time() - self.start_time
                print(f"✓ Password found: '{password}' after {self.attempts} attempts in {elapsed_time:.2f}s")
                return password
            
            # Progress indicator for large dictionaries
            if self.attempts % 10000 == 0:
                elapsed_time = time.time() - self.start_time
                rate = self.attempts / elapsed_time if elapsed_time > 0 else 0
                print(f"  Tried {self.attempts} passwords ({rate:.0f} attempts/sec)...")
        
        elapsed_time = time.time() - self.start_time
        print(f"✗ Password not found after {self.attempts} attempts in {elapsed_time:.2f}s")
        return None
    
    def attack_multiple_hashes(self, target_hashes: Dict[str, str], dictionary: List[str]) -> Dict[str, str]:
        """Attack multiple hashes simultaneously"""
        self.attempts = 0
        self.start_time = time.time()
        found_passwords = {}
        remaining_hashes = target_hashes.copy()
        
        print(f"Attacking {len(target_hashes)} hashes simultaneously...")
        
        for password in dictionary:
            self.attempts += 1
            computed_hash = self.hasher.hash_password(password, self.hash_algorithm, self.salt)
            
            if computed_hash in remaining_hashes:
                original_password = remaining_hashes[computed_hash]
                found_passwords[computed_hash] = password
                print(f"✓ Found password: '{password}' (original: '{original_password}')")
                del remaining_hashes[computed_hash]
                
                if not remaining_hashes:
                    break
            
            # Progress indicator
            if self.attempts % 5000 == 0:
                elapsed_time = time.time() - self.start_time
                rate = self.attempts / elapsed_time if elapsed_time > 0 else 0
                found_count = len(found_passwords)
                remaining_count = len(remaining_hashes)
                print(f"  Progress: {self.attempts} attempts, {found_count} found, {remaining_count} remaining ({rate:.0f} attempts/sec)")
        
        elapsed_time = time.time() - self.start_time
        success_rate = len(found_passwords) / len(target_hashes) * 100
        print(f"\nAttack completed: {len(found_passwords)}/{len(target_hashes)} passwords cracked ({success_rate:.1f}% success rate)")
        print(f"Total attempts: {self.attempts}, Time: {elapsed_time:.2f}s, Rate: {self.attempts/elapsed_time:.0f} attempts/sec")
        
        return found_passwords
    
    def brute_force_attack(self, target_hash: str, charset: str, max_length: int = 4) -> Optional[str]:
        """Perform brute force attack for short passwords"""
        self.attempts = 0
        self.start_time = time.time()
        
        print(f"Brute force attack on hash {target_hash[:16]}... (max length: {max_length})")
        
        for length in range(1, max_length + 1):
            for password in itertools.product(charset, repeat=length):
                password_str = ''.join(password)
                self.attempts += 1
                
                computed_hash = self.hasher.hash_password(password_str, self.hash_algorithm, self.salt)
                
                if computed_hash == target_hash:
                    elapsed_time = time.time() - self.start_time
                    print(f"✓ Password found: '{password_str}' after {self.attempts} attempts in {elapsed_time:.2f}s")
                    return password_str
                
                # Progress indicator
                if self.attempts % 10000 == 0:
                    elapsed_time = time.time() - self.start_time
                    rate = self.attempts / elapsed_time if elapsed_time > 0 else 0
                    print(f"  Tried {self.attempts} passwords (length {length}) - {rate:.0f} attempts/sec")
        
        elapsed_time = time.time() - self.start_time
        print(f"✗ Password not found after {self.attempts} attempts in {elapsed_time:.2f}s")
        return None


class AttackStatistics:
    """Class to track and analyze attack statistics"""
    
    def __init__(self):
        self.results = []
    
    def add_result(self, attack_type: str, target_count: int, found_count: int, 
                   attempts: int, time_taken: float, algorithm: str):
        """Add attack result to statistics"""
        self.results.append({
            'attack_type': attack_type,
            'target_count': target_count,
            'found_count': found_count,
            'success_rate': found_count / target_count * 100 if target_count > 0 else 0,
            'attempts': attempts,
            'time_taken': time_taken,
            'attempts_per_second': attempts / time_taken if time_taken > 0 else 0,
            'algorithm': algorithm
        })
    
    def print_summary(self):
        """Print attack statistics summary"""
        if not self.results:
            print("No attack results to summarize")
            return
        
        print("\n" + "="*60)
        print("ATTACK STATISTICS SUMMARY")
        print("="*60)
        
        for i, result in enumerate(self.results, 1):
            print(f"\nAttack {i}: {result['attack_type']}")
            print(f"  Algorithm: {result['algorithm']}")
            print(f"  Targets: {result['target_count']}, Found: {result['found_count']}")
            print(f"  Success Rate: {result['success_rate']:.1f}%")
            print(f"  Attempts: {result['attempts']:,}")
            print(f"  Time: {result['time_taken']:.2f}s")
            print(f"  Speed: {result['attempts_per_second']:,.0f} attempts/sec")
        
        # Overall statistics
        total_targets = sum(r['target_count'] for r in self.results)
        total_found = sum(r['found_count'] for r in self.results)
        total_attempts = sum(r['attempts'] for r in self.results)
        total_time = sum(r['time_taken'] for r in self.results)
        
        print(f"\nOVERALL STATISTICS:")
        print(f"  Total Targets: {total_targets}")
        print(f"  Total Found: {total_found}")
        print(f"  Overall Success Rate: {total_found/total_targets*100:.1f}%")
        print(f"  Total Attempts: {total_attempts:,}")
        print(f"  Total Time: {total_time:.2f}s")
        print(f"  Average Speed: {total_attempts/total_time:,.0f} attempts/sec")


def create_sample_dictionaries():
    """Create sample dictionary files for testing"""
    
    # Create common passwords dictionary
    common_dict_path = "/media/askeladd/32B07941B0790D1B1/Gibberish/Dictionary-attack/common_passwords.txt"
    
    attack = DictionaryAttack()
    common_passwords = attack.generate_common_passwords()
    
    with open(common_dict_path, 'w') as f:
        for password in common_passwords:
            f.write(password + '\n')
    
    print(f"Created common passwords dictionary: {common_dict_path} ({len(common_passwords)} passwords)")
    
    # Create rockyou-style dictionary (subset)
    rockyou_dict_path = "/media/askeladd/32B07941B0790D1B1/Gibberish/Dictionary-attack/rockyou_subset.txt"
    
    # Generate more realistic passwords
    realistic_passwords = []
    
    # Base words
    base_words = ['password', 'admin', 'user', 'test', 'guest', 'root', 'login',
                  'welcome', 'secret', 'private', 'public', 'default', 'temp']
    
    # Common patterns
    years = [str(year) for year in range(1980, 2026)]
    numbers = ['1', '12', '123', '1234', '12345', '123456']
    symbols = ['!', '@', '#', '$', '%', '&', '*']
    
    # Generate combinations
    for word in base_words:
        realistic_passwords.extend([
            word, word.upper(), word.capitalize(),
            word + '1', word + '123', word + '2023',
            word + '!', word + '@', word + '#',
            '123' + word, word + word,
        ])
    
    # Add common names with numbers
    names = ['john', 'mary', 'david', 'sarah', 'michael', 'jessica', 'admin', 'user']
    for name in names:
        for num in numbers[:4]:  # First 4 number patterns
            realistic_passwords.extend([name + num, name.capitalize() + num])
    
    # Remove duplicates and sort
    realistic_passwords = sorted(list(set(realistic_passwords)))
    
    with open(rockyou_dict_path, 'w') as f:
        for password in realistic_passwords:
            f.write(password + '\n')
    
    print(f"Created realistic passwords dictionary: {rockyou_dict_path} ({len(realistic_passwords)} passwords)")
    
    return common_dict_path, rockyou_dict_path


def main():
    """Main function to run dictionary attack simulation"""
    print("Dictionary Attack Simulation")
    print("=" * 40)
    
    # Create sample dictionaries
    common_dict, realistic_dict = create_sample_dictionaries()
    
    # Initialize attack class and statistics
    stats = AttackStatistics()
    
    # Test different hash algorithms
    algorithms = ['md5', 'sha1', 'sha256']
    
    for algorithm in algorithms:
        print(f"\n{'='*20} Testing {algorithm.upper()} {'='*20}")
        
        attacker = DictionaryAttack(hash_algorithm=algorithm)
        
        # Create some target passwords to crack
        target_passwords = ['password', 'admin123', 'qwerty', 'welcome!', 'test', 'secret123']
        target_hashes = attacker.generate_target_hashes(target_passwords)
        
        print(f"Generated {len(target_hashes)} target hashes using {algorithm}")
        for hash_val, password in list(target_hashes.items())[:3]:  # Show first 3
            print(f"  {password} -> {hash_val[:16]}...")
        
        # Load dictionary and perform attack
        dictionary = attacker.load_dictionary(realistic_dict)
        if dictionary:
            start_time = time.time()
            found_passwords = attacker.attack_multiple_hashes(target_hashes, dictionary)
            elapsed_time = time.time() - start_time
            
            stats.add_result(
                attack_type=f"Dictionary Attack ({algorithm})",
                target_count=len(target_hashes),
                found_count=len(found_passwords),
                attempts=attacker.attempts,
                time_taken=elapsed_time,
                algorithm=algorithm
            )
    
    # Demonstrate brute force attack on a simple password
    print(f"\n{'='*20} Brute Force Demo {'='*20}")
    
    simple_password = "abc"
    attacker = DictionaryAttack(hash_algorithm='md5')
    target_hash = attacker.hasher.hash_password(simple_password, 'md5')
    
    charset = string.ascii_lowercase  # a-z only
    start_time = time.time()
    found_password = attacker.brute_force_attack(target_hash, charset, max_length=4)
    elapsed_time = time.time() - start_time
    
    if found_password:
        stats.add_result(
            attack_type="Brute Force (MD5)",
            target_count=1,
            found_count=1,
            attempts=attacker.attempts,
            time_taken=elapsed_time,
            algorithm='md5'
        )
    
    # Print final statistics
    stats.print_summary()
    
    # Security recommendations
    print(f"\n{'='*60}")
    print("SECURITY RECOMMENDATIONS")
    print("="*60)
    print("1. Use long, complex passwords (12+ characters)")
    print("2. Include uppercase, lowercase, numbers, and symbols")
    print("3. Avoid dictionary words and common patterns")
    print("4. Use unique passwords for each account")
    print("5. Enable two-factor authentication")
    print("6. Use a password manager")
    print("7. For systems: use strong hashing algorithms (bcrypt, Argon2)")
    print("8. Implement rate limiting and account lockouts")


if __name__ == "__main__":
    main()