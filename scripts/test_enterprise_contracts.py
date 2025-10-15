#!/usr/bin/env python3
"""
Enterprise Contract Testing Framework
Comprehensive testing suite for all enterprise smart contracts

Features:
- Contract compilation validation
- PyTeal syntax verification
- Enterprise code quality checks
- Performance benchmarking
- Security validation
"""

import sys
import time
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import all enterprise contracts
from contracts.protocol.EnterpriseHALGO import compile_and_validate as test_halgo
from contracts.oracles.EnterprisePriceOracle import compile_and_validate as test_oracle
from contracts.protocol.SimpleHALGO import approval_program as simple_halgo_approval, clear_state_program as simple_halgo_clear
from contracts.oracles.SimplePriceOracle import approval_program as simple_oracle_approval, clear_state_program as simple_oracle_clear
from pyteal import compileTeal, Mode

class EnterpriseContractTester:
    """Enterprise-grade contract testing framework"""
    
    def __init__(self):
        self.test_results = {}
        self.performance_metrics = {}
        self.security_checks = {}
        
    def test_contract_compilation(self, name: str, approval_func, clear_func) -> Dict[str, Any]:
        """Test contract compilation with detailed metrics"""
        try:
            print(f"🧪 Testing {name} compilation...")
            start_time = time.time()
            
            # Compile approval program
            approval_teal = compileTeal(approval_func(), Mode.Application, version=6)
            approval_time = time.time() - start_time
            
            # Compile clear state program
            clear_start = time.time()
            clear_teal = compileTeal(clear_func(), Mode.Application, version=6)
            clear_time = time.time() - clear_start
            
            total_time = time.time() - start_time
            
            # Calculate metrics
            metrics = {
                'compilation_successful': True,
                'approval_program_size': len(approval_teal),
                'clear_program_size': len(clear_teal),
                'approval_compile_time': approval_time,
                'clear_compile_time': clear_time,
                'total_compile_time': total_time,
                'teal_version': 6,
                'approval_lines': len(approval_teal.split('\n')),
                'clear_lines': len(clear_teal.split('\n'))
            }
            
            print(f"   ✅ {name} compilation successful!")
            print(f"      Approval: {metrics['approval_program_size']} chars, {metrics['approval_lines']} lines")
            print(f"      Clear: {metrics['clear_program_size']} chars, {metrics['clear_lines']} lines")
            print(f"      Compile time: {total_time:.3f}s")
            
            return metrics
            
        except Exception as e:
            print(f"   ❌ {name} compilation failed: {e}")
            return {
                'compilation_successful': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
    
    def analyze_code_quality(self, name: str, approval_func, clear_func) -> Dict[str, Any]:
        """Analyze code quality and complexity"""
        try:
            print(f"📊 Analyzing {name} code quality...")
            
            # Get TEAL code
            approval_teal = compileTeal(approval_func(), Mode.Application, version=6)
            clear_teal = compileTeal(clear_func(), Mode.Application, version=6)
            
            # Analyze approval program
            approval_lines = approval_teal.split('\n')
            approval_instructions = [line.strip() for line in approval_lines if line.strip() and not line.strip().startswith('//')]
            
            # Count instruction types
            instruction_counts = {}
            for instruction in approval_instructions:
                op = instruction.split()[0] if instruction.split() else ''
                instruction_counts[op] = instruction_counts.get(op, 0) + 1
            
            # Calculate complexity metrics
            complexity_score = len(approval_instructions)
            branch_instructions = sum(instruction_counts.get(op, 0) for op in ['bnz', 'bz', 'b', 'callsub', 'retsub'])
            arithmetic_instructions = sum(instruction_counts.get(op, 0) for op in ['+', '-', '*', '/', '%'])
            crypto_instructions = sum(instruction_counts.get(op, 0) for op in ['sha256', 'keccak256', 'sha512_256'])
            
            quality_metrics = {
                'total_instructions': len(approval_instructions),
                'unique_instructions': len(instruction_counts),
                'complexity_score': complexity_score,
                'branch_instructions': branch_instructions,
                'arithmetic_instructions': arithmetic_instructions,
                'crypto_instructions': crypto_instructions,
                'instruction_distribution': instruction_counts,
                'code_density': len(approval_teal) / len(approval_lines) if approval_lines else 0
            }
            
            print(f"   📈 {name} quality analysis complete!")
            print(f"      Instructions: {quality_metrics['total_instructions']}")
            print(f"      Complexity: {quality_metrics['complexity_score']}")
            print(f"      Branches: {quality_metrics['branch_instructions']}")
            
            return quality_metrics
            
        except Exception as e:
            print(f"   ❌ {name} quality analysis failed: {e}")
            return {'analysis_successful': False, 'error': str(e)}
    
    def security_audit(self, name: str, approval_func, clear_func) -> Dict[str, Any]:
        """Perform basic security audit"""
        try:
            print(f"🔒 Performing {name} security audit...")
            
            # Get TEAL code
            approval_teal = compileTeal(approval_func(), Mode.Application, version=6)
            
            # Security checks
            security_issues = []
            security_score = 100
            
            # Check for common security patterns
            if 'assert' not in approval_teal.lower():
                security_issues.append("No assertion statements found")
                security_score -= 20
            
            if 'global creator_address' not in approval_teal.lower():
                security_issues.append("Creator address validation not found")
                security_score -= 15
            
            if 'txn sender' not in approval_teal.lower():
                security_issues.append("Sender validation not found")
                security_score -= 10
            
            # Check for proper transaction type validation
            if 'txn type_enum' not in approval_teal.lower():
                security_issues.append("Transaction type validation not found")
                security_score -= 15
            
            # Check for amount validation
            if 'txn amount' not in approval_teal.lower() and 'gtxn' in approval_teal.lower():
                security_issues.append("Amount validation may be missing")
                security_score -= 10
            
            security_metrics = {
                'security_score': max(0, security_score),
                'security_issues': security_issues,
                'has_assertions': 'assert' in approval_teal.lower(),
                'has_creator_check': 'global creator_address' in approval_teal.lower(),
                'has_sender_check': 'txn sender' in approval_teal.lower(),
                'has_type_check': 'txn type_enum' in approval_teal.lower(),
                'audit_passed': security_score >= 70
            }
            
            print(f"   🛡️  {name} security audit complete!")
            print(f"      Security score: {security_metrics['security_score']}/100")
            print(f"      Issues found: {len(security_issues)}")
            
            return security_metrics
            
        except Exception as e:
            print(f"   ❌ {name} security audit failed: {e}")
            return {'audit_successful': False, 'error': str(e)}
    
    def run_comprehensive_tests(self) -> Dict[str, Any]:
        """Run comprehensive test suite on all contracts"""
        print("🏢 Enterprise Contract Testing Framework")
        print("=" * 70)
        
        test_start = time.time()
        
        # Test contracts
        contracts_to_test = [
            ("Enterprise hALGO Protocol", test_halgo),
            ("Enterprise Price Oracle", test_oracle),
            ("Simple hALGO Protocol", lambda: self.test_contract_compilation("Simple hALGO", simple_halgo_approval, simple_halgo_clear)),
            ("Simple Price Oracle", lambda: self.test_contract_compilation("Simple Oracle", simple_oracle_approval, simple_oracle_clear))
        ]
        
        all_results = {}
        
        for contract_name, test_func in contracts_to_test:
            print(f"\n🔬 Testing {contract_name}")
            print("-" * 50)
            
            try:
                if contract_name.startswith("Enterprise"):
                    # Use built-in test function
                    result = test_func()
                else:
                    # Use our test framework
                    if "hALGO" in contract_name:
                        compilation_result = self.test_contract_compilation(contract_name, simple_halgo_approval, simple_halgo_clear)
                        quality_result = self.analyze_code_quality(contract_name, simple_halgo_approval, simple_halgo_clear)
                        security_result = self.security_audit(contract_name, simple_halgo_approval, simple_halgo_clear)
                    else:
                        compilation_result = self.test_contract_compilation(contract_name, simple_oracle_approval, simple_oracle_clear)
                        quality_result = self.analyze_code_quality(contract_name, simple_oracle_approval, simple_oracle_clear)
                        security_result = self.security_audit(contract_name, simple_oracle_approval, simple_oracle_clear)
                    
                    result = {
                        'compilation': compilation_result,
                        'quality': quality_result,
                        'security': security_result
                    }
                
                all_results[contract_name] = result
                
            except Exception as e:
                print(f"   ❌ {contract_name} testing failed: {e}")
                all_results[contract_name] = {'error': str(e)}
        
        total_test_time = time.time() - test_start
        
        # Generate summary report
        print(f"\n📋 Enterprise Testing Summary")
        print("=" * 70)
        print(f"Total testing time: {total_test_time:.2f} seconds")
        
        successful_tests = 0
        total_tests = len(contracts_to_test)
        
        for contract_name, result in all_results.items():
            if 'error' not in result:
                if 'compilation_successful' in result:
                    status = "✅ PASS" if result['compilation_successful'] else "❌ FAIL"
                else:
                    status = "✅ PASS"
                successful_tests += 1
            else:
                status = "❌ FAIL"
            
            print(f"   {contract_name}: {status}")
        
        print(f"\nTest Results: {successful_tests}/{total_tests} contracts passed")
        
        if successful_tests == total_tests:
            print("🎉 All enterprise contracts passed testing!")
        else:
            print("⚠️  Some contracts failed testing - review results above")
        
        return {
            'test_results': all_results,
            'summary': {
                'total_tests': total_tests,
                'successful_tests': successful_tests,
                'success_rate': successful_tests / total_tests * 100,
                'total_test_time': total_test_time
            }
        }

def main():
    """Main testing function"""
    tester = EnterpriseContractTester()
    results = tester.run_comprehensive_tests()
    
    # Return success if all tests passed
    return results['summary']['successful_tests'] == results['summary']['total_tests']

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
