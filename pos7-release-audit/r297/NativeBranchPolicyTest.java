package com.sokkarzeyedeh.pos7;
public final class NativeBranchPolicyTest {
 static int n=0;
 static void check(boolean b){n++;if(!b)throw new AssertionError("failed case "+n);}
 public static void main(String[] a){
  check(!NativeBranchPolicy.mayReadForPreflight(null,"tab1","jdcolkgzwqpwbfvcrdje"));
  check(!NativeBranchPolicy.mayReadForPreflight("","tab1","jdcolkgzwqpwbfvcrdje"));
  check(!NativeBranchPolicy.mayReadForPreflight("tab1","tab2","jdcolkgzwqpwbfvcrdje"));
  check(!NativeBranchPolicy.mayReadForPreflight("tab2","tab1","rmskuolsiqbzxuakofpb"));
  check(!NativeBranchPolicy.mayReadForPreflight("tab1","tab1","rmskuolsiqbzxuakofpb"));
  check(!NativeBranchPolicy.mayReadForPreflight("tab2","tab2","jdcolkgzwqpwbfvcrdje"));
  check(NativeBranchPolicy.mayReadForPreflight("tab1","tab1","jdcolkgzwqpwbfvcrdje"));
  check(NativeBranchPolicy.mayReadForPreflight("tab2","tab2","rmskuolsiqbzxuakofpb"));
  check(!NativeBranchPolicy.mayReadForPreflight("junk","junk","jdcolkgzwqpwbfvcrdje"));
  check(!NativeBranchPolicy.mayReadForPreflight("tab1","tab1",null));
  System.out.println("PASS "+n+" fail-closed branch policy tests");
 }
}
