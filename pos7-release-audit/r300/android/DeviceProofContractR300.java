package com.sokkarzeyedeh.pos7;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Pattern;
/** Canonical server-bound challenge; never an authorization by itself. */
public final class DeviceProofContractR300 {
 private static final Pattern NONCE=Pattern.compile("[a-f0-9]{64}");
 private DeviceProofContractR300(){}
 private static String uuid(String s){
  if(s==null || !s.equals(UUID.fromString(s).toString()))throw new IllegalArgumentException("invalid_uuid");return s;
 }
 public static byte[] payload(String branch,String project,String device,String challenge,String nonce,
                                long revision,long epoch,String sectionsHash,long iat,long exp){
  if(!(("tab1".equals(branch)&&"jdcolkgzwqpwbfvcrdje".equals(project)) ||
       ("tab2".equals(branch)&&"rmskuolsiqbzxuakofpb".equals(project))))throw new IllegalArgumentException("branch_project");
  uuid(device);uuid(challenge);
  if(nonce==null||!NONCE.matcher(nonce).matches()||sectionsHash==null||!NONCE.matcher(sectionsHash).matches())
   throw new IllegalArgumentException("invalid_digest_or_nonce");
  if(revision<0||epoch<0||iat<=0||exp<=iat||exp-iat>300)throw new IllegalArgumentException("invalid_interval");
  String s="POS7-ROTATE-R300\nbranch="+branch+"\nproject="+project+"\ndevice="+device+
   "\nchallenge="+challenge+"\nnonce="+nonce+"\nrevision="+revision+"\nepoch="+epoch+
   "\nsections_sha256="+sectionsHash+"\niat="+iat+"\nexp="+exp+"\n";
  return s.getBytes(StandardCharsets.US_ASCII);
 }
}