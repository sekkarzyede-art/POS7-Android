package com.sokkarzeyedeh.pos7;
public final class NativeBranchPolicy {
 public static final String FIRST_PROJECT="jdcolkgzwqpwbfvcrdje",SECOND_PROJECT="rmskuolsiqbzxuakofpb";
 public static String expectedProject(String branch){
  if("tab1".equals(branch))return FIRST_PROJECT;
  if("tab2".equals(branch))return SECOND_PROJECT;
  return null;
 }
 public static boolean mayReadForPreflight(String nativeBranch,String selectedBranch,String project){
  String expected=expectedProject(selectedBranch);
  return expected!=null&&expected.equals(project)&&(nativeBranch==null||nativeBranch.isEmpty()||nativeBranch.equals(selectedBranch));
 }
 public static boolean mayStartBusiness(String oldBranch,String selectedBranch,String project,boolean publisher,boolean restored,boolean writersFenced){
  return oldBranch!=null&&oldBranch.equals(selectedBranch)&&mayReadForPreflight(oldBranch,selectedBranch,project)&&publisher&&restored&&writersFenced;
 }
}
