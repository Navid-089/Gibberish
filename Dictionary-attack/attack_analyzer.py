#!/usr/bin/env python3
"""
Advanced Dictionary Attack Analyzer
Comprehensive analysis of password security and attack effectiveness
"""

import time
import hashlib
import matplotlib.pyplot as plt
import pandas as pd
from dictionary_attack import DictionaryAttack, AttackStatistics
from password_generator import PasswordGenerator
import seaborn as sns
import numpy as np
from typing import Dict, List, Tuple


class AttackAnalyzer:
    """Advanced analyzer for dictionary attacks with visualization"""
    
    def __init__(self):
        self.results = []
        self.timing_data = []
        
    def analyze_password_strength_vs_crack_time(self):
        """Analyze relationship between password strength and crack time"""
        print("Analyzing Password Strength vs Crack Time...")
        
        generator = PasswordGenerator()
        all_passwords = generator.generate_all_types()
        
        results = []
        
        for category, passwords in all_passwords.items():
            print(f"Testing {category} passwords...")
            
            attacker = DictionaryAttack(hash_algorithm='sha256')
            dictionary = attacker.generate_common_passwords()
            
            for password in passwords[:5]:  # Test first 5 of each category
                target_hash = attacker.hasher.hash_password(password, 'sha256')
                
                start_time = time.time()
                found = attacker.attack_single_hash(target_hash, dictionary)
                elapsed_time = time.time() - start_time
                
                results.append({
                    'category': category,
                    'password': password,
                    'length': len(password),
                    'found': found is not None,
                    'attempts': attacker.attempts,
                    'time': elapsed_time,
                    'has_uppercase': any(c.isupper() for c in password),
                    'has_lowercase': any(c.islower() for c in password),
                    'has_digits': any(c.isdigit() for c in password),
                    'has_symbols': any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password)
                })
        
        return pd.DataFrame(results)
    
    def compare_hash_algorithms(self):
        """Compare attack performance across different hash algorithms"""
        print("Comparing Hash Algorithm Performance...")
        
        algorithms = ['md5', 'sha1', 'sha256', 'sha512']
        test_passwords = ['password', 'admin123', 'qwerty', 'welcome!', 'test123']
        
        results = []
        
        for algorithm in algorithms:
            print(f"Testing {algorithm.upper()}...")
            
            attacker = DictionaryAttack(hash_algorithm=algorithm)
            dictionary = attacker.generate_common_passwords()
            
            # Test each password
            total_time = 0
            total_attempts = 0
            found_count = 0
            
            for password in test_passwords:
                target_hash = attacker.hasher.hash_password(password, algorithm)
                
                start_time = time.time()
                found = attacker.attack_single_hash(target_hash, dictionary)
                elapsed_time = time.time() - start_time
                
                total_time += elapsed_time
                total_attempts += attacker.attempts
                if found:
                    found_count += 1
            
            avg_time = total_time / len(test_passwords)
            avg_attempts = total_attempts / len(test_passwords)
            success_rate = found_count / len(test_passwords) * 100
            
            results.append({
                'algorithm': algorithm,
                'avg_time': avg_time,
                'avg_attempts': avg_attempts,
                'success_rate': success_rate,
                'attempts_per_second': avg_attempts / avg_time if avg_time > 0 else 0
            })
        
        return pd.DataFrame(results)
    
    def dictionary_size_impact(self):
        """Analyze how dictionary size affects attack success and performance"""
        print("Analyzing Dictionary Size Impact...")
        
        generator = PasswordGenerator()
        weak_passwords = generator.generate_weak_passwords(10)
        
        # Create dictionaries of different sizes
        attacker = DictionaryAttack()
        base_dict = attacker.generate_common_passwords()
        
        dict_sizes = [50, 100, 200, 500, 1000]
        results = []
        
        for size in dict_sizes:
            print(f"Testing dictionary size: {size}")
            
            # Create dictionary of specified size
            test_dict = base_dict[:size] if size <= len(base_dict) else base_dict
            
            # Test on weak passwords
            found_count = 0
            total_attempts = 0
            total_time = 0
            
            for password in weak_passwords[:5]:  # Test first 5
                target_hash = attacker.hasher.hash_password(password, 'sha256')
                
                start_time = time.time()
                found = attacker.attack_single_hash(target_hash, test_dict)
                elapsed_time = time.time() - start_time
                
                total_time += elapsed_time
                total_attempts += attacker.attempts
                if found:
                    found_count += 1
            
            results.append({
                'dict_size': size,
                'success_rate': found_count / 5 * 100,
                'avg_attempts': total_attempts / 5,
                'avg_time': total_time / 5,
                'attempts_per_second': total_attempts / total_time if total_time > 0 else 0
            })
        
        return pd.DataFrame(results)
    
    def salt_effectiveness_test(self):
        """Test effectiveness of salted vs unsalted hashes"""
        print("Testing Salt Effectiveness...")
        
        test_passwords = ['password', 'admin', 'qwerty', '123456', 'welcome']
        salt = 'random_salt_123'
        
        results = []
        
        # Test without salt
        attacker_no_salt = DictionaryAttack(hash_algorithm='sha256', salt='')
        dictionary = attacker_no_salt.generate_common_passwords()
        
        print("Testing without salt...")
        found_count_no_salt = 0
        total_time_no_salt = 0
        
        for password in test_passwords:
            target_hash = attacker_no_salt.hasher.hash_password(password, 'sha256', '')
            start_time = time.time()
            found = attacker_no_salt.attack_single_hash(target_hash, dictionary)
            elapsed_time = time.time() - start_time
            
            total_time_no_salt += elapsed_time
            if found:
                found_count_no_salt += 1
        
        # Test with salt
        attacker_salt = DictionaryAttack(hash_algorithm='sha256', salt=salt)
        
        print("Testing with salt...")
        found_count_salt = 0
        total_time_salt = 0
        
        for password in test_passwords:
            target_hash = attacker_salt.hasher.hash_password(password, 'sha256', salt)
            start_time = time.time()
            found = attacker_salt.attack_single_hash(target_hash, dictionary)
            elapsed_time = time.time() - start_time
            
            total_time_salt += elapsed_time
            if found:
                found_count_salt += 1
        
        return {
            'no_salt': {
                'success_rate': found_count_no_salt / len(test_passwords) * 100,
                'avg_time': total_time_no_salt / len(test_passwords)
            },
            'with_salt': {
                'success_rate': found_count_salt / len(test_passwords) * 100,
                'avg_time': total_time_salt / len(test_passwords)
            }
        }
    
    def generate_security_report(self):
        """Generate comprehensive security analysis report"""
        print("\n" + "="*60)
        print("COMPREHENSIVE SECURITY ANALYSIS REPORT")
        print("="*60)
        
        # Password strength analysis
        strength_df = self.analyze_password_strength_vs_crack_time()
        
        print("\n1. PASSWORD STRENGTH ANALYSIS:")
        print("-" * 40)
        for category in strength_df['category'].unique():
            cat_data = strength_df[strength_df['category'] == category]
            success_rate = cat_data['found'].mean() * 100
            avg_length = cat_data['length'].mean()
            print(f"  {category.upper()}: {success_rate:.1f}% cracked, avg length: {avg_length:.1f}")
        
        # Hash algorithm comparison
        hash_df = self.compare_hash_algorithms()
        
        print("\n2. HASH ALGORITHM COMPARISON:")
        print("-" * 40)
        for _, row in hash_df.iterrows():
            print(f"  {row['algorithm'].upper()}: {row['success_rate']:.1f}% success, "
                  f"{row['attempts_per_second']:,.0f} attempts/sec")
        
        # Dictionary size impact
        dict_df = self.dictionary_size_impact()
        
        print("\n3. DICTIONARY SIZE IMPACT:")
        print("-" * 40)
        for _, row in dict_df.iterrows():
            print(f"  Size {row['dict_size']:4d}: {row['success_rate']:.1f}% success, "
                  f"{row['attempts_per_second']:,.0f} attempts/sec")
        
        # Salt effectiveness
        salt_results = self.salt_effectiveness_test()
        
        print("\n4. SALT EFFECTIVENESS:")
        print("-" * 40)
        print(f"  No Salt:   {salt_results['no_salt']['success_rate']:.1f}% success")
        print(f"  With Salt: {salt_results['with_salt']['success_rate']:.1f}% success")
        print(f"  Salt reduces success by: {salt_results['no_salt']['success_rate'] - salt_results['with_salt']['success_rate']:.1f}%")
        
        # Security recommendations
        print("\n5. SECURITY RECOMMENDATIONS:")
        print("-" * 40)
        print("  ✓ Use passwords longer than 12 characters")
        print("  ✓ Include mixed case, numbers, and symbols")
        print("  ✓ Avoid dictionary words and common patterns")
        print("  ✓ Always use salt with password hashes")
        print("  ✓ Use slow hashing algorithms (bcrypt, Argon2)")
        print("  ✓ Implement rate limiting and account lockouts")
        print("  ✓ Enable multi-factor authentication")
        print("  ✓ Regular password policy audits")
        
        return {
            'strength_analysis': strength_df,
            'hash_comparison': hash_df,
            'dictionary_impact': dict_df,
            'salt_effectiveness': salt_results
        }


def main():
    """Run comprehensive dictionary attack analysis"""
    analyzer = AttackAnalyzer()
    
    print("Starting Comprehensive Dictionary Attack Analysis...")
    print("This may take a few minutes to complete.\n")
    
    # Generate comprehensive report
    report_data = analyzer.generate_security_report()
    
    # Save detailed results to files
    base_path = "/media/askeladd/32B07941B0790D1B1/Gibberish/Dictionary-attack/"
    
    if not report_data['strength_analysis'].empty:
        report_data['strength_analysis'].to_csv(base_path + 'password_strength_analysis.csv', index=False)
        print(f"\nPassword strength analysis saved to: {base_path}password_strength_analysis.csv")
    
    if not report_data['hash_comparison'].empty:
        report_data['hash_comparison'].to_csv(base_path + 'hash_algorithm_comparison.csv', index=False)
        print(f"Hash algorithm comparison saved to: {base_path}hash_algorithm_comparison.csv")
    
    if not report_data['dictionary_impact'].empty:
        report_data['dictionary_impact'].to_csv(base_path + 'dictionary_size_impact.csv', index=False)
        print(f"Dictionary size impact saved to: {base_path}dictionary_size_impact.csv")
    
    print("\nAnalysis complete! Check the generated CSV files for detailed data.")


if __name__ == "__main__":
    main()