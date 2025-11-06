#!/usr/bin/env python3
"""
Dictionary Attack Demo
A simple demonstration of the dictionary attack simulation
"""

from dictionary_attack import DictionaryAttack, AttackStatistics
from password_generator import PasswordGenerator


def run_basic_demo():
    """Run a basic dictionary attack demonstration"""
    print("🔐 Dictionary Attack Simulation Demo")
    print("=" * 50)
    
    # Initialize components
    generator = PasswordGenerator()
    attacker = DictionaryAttack(hash_algorithm='sha256')
    
    # Generate some test passwords
    print("\n📋 Generating test passwords...")
    weak_passwords = generator.generate_weak_passwords(5)
    medium_passwords = generator.generate_medium_passwords(3)
    
    print("Weak passwords to test:", weak_passwords)
    print("Medium passwords to test:", medium_passwords)
    
    # Create target hashes
    all_test_passwords = weak_passwords + medium_passwords
    target_hashes = attacker.generate_target_hashes(all_test_passwords)
    
    print(f"\n🎯 Generated {len(target_hashes)} target hashes")
    
    # Load attack dictionary
    dictionary = attacker.generate_common_passwords()
    print(f"📚 Dictionary loaded with {len(dictionary)} passwords")
    
    # Perform the attack
    print(f"\n⚔️  Starting dictionary attack...")
    found_passwords = attacker.attack_multiple_hashes(target_hashes, dictionary)
    
    # Results summary
    success_rate = len(found_passwords) / len(target_hashes) * 100
    print(f"\n📊 ATTACK RESULTS:")
    print(f"   Total targets: {len(target_hashes)}")
    print(f"   Passwords found: {len(found_passwords)}")
    print(f"   Success rate: {success_rate:.1f}%")
    print(f"   Total attempts: {attacker.attempts:,}")
    
    # Show found passwords
    if found_passwords:
        print(f"\n✅ Successfully cracked passwords:")
        for hash_val, password in found_passwords.items():
            original = target_hashes[hash_val]
            print(f"   '{original}' -> Found as '{password}'")
    
    # Show uncracked passwords
    uncracked = [target_hashes[h] for h in target_hashes if h not in found_passwords]
    if uncracked:
        print(f"\n🔒 Passwords that resisted the attack:")
        for password in uncracked:
            print(f"   '{password}' - Too strong for dictionary attack")


def run_algorithm_comparison():
    """Compare different hash algorithms"""
    print(f"\n🔍 Hash Algorithm Comparison")
    print("=" * 40)
    
    algorithms = ['md5', 'sha1', 'sha256']
    test_password = 'password123'
    
    for algorithm in algorithms:
        attacker = DictionaryAttack(hash_algorithm=algorithm)
        dictionary = attacker.generate_common_passwords()[:100]  # Smaller dict for demo
        
        target_hash = attacker.hasher.hash_password(test_password, algorithm)
        
        print(f"\n{algorithm.upper()} Attack:")
        found = attacker.attack_single_hash(target_hash, dictionary)
        
        if found:
            print(f"  ✅ Success! Found '{found}' in {attacker.attempts} attempts")
        else:
            print(f"  ❌ Failed after {attacker.attempts} attempts")


if __name__ == "__main__":
    # Run the basic demo
    run_basic_demo()
    
    # Run algorithm comparison
    run_algorithm_comparison()
    
    print(f"\n🛡️  Security Tip: The passwords that resisted the attack")
    print("   demonstrate the importance of using strong, unique passwords!")
    print("\n✨ Demo complete! Try running the full analysis with:")
    print("   python3 dictionary_attack.py")
    print("   python3 attack_analyzer.py")