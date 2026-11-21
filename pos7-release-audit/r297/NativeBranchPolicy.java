package com.sokkarzeyedeh.pos7;
/** R297: Only a previously verified native branch may request read-only preflight. */
public final class NativeBranchPolicy {
 private NativeBranchPolicy(){}
 public static boolean mayReadForPreflight(String verifiedBranch,String selectedBranch,String project) {
  if(verifiedBranch==null||verifiedBranch.isEmpty()||!verifiedBranch.equals(selectedBranch)) return false;
  if("tab1".equals(verifiedBranch)) return "jdcolkgzwqpwbfvcrdje".equals(project);
  if("tab2".equals(verifiedBranch)) return "rmskuolsiqbzxuakofpb".equals(project);
  return false;
 }
}
