import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({resolve(s,c,next){return s==="server-only"?{url:"data:text/javascript,export{}",shortCircuit:true}:next(s,c);}});
const {detectSanctions,ratingPenalty}=await import("../src/app/lib/sanctions.ts");
const base=process.env.ADMIN_TEST_URL||"http://localhost:3000";
test("sanctions: detection, human decisions, deduplication, appeals, reversal and permissions",{timeout:180000},async()=>{
  const marker=`Sanction QA ${crypto.randomUUID()}`, users=[],requests=[];
  const originals=await prisma.sanctionRule.findMany();let category;
  async function account(role,suspended=false){const user=await prisma.user.create({data:{name:marker,email:`${crypto.randomUUID()}@example.invalid`,password:"fixture",role,status:role==="PROFESSIONAL"?"APPROVED":"ACTIVE",termsAccepted:true,isSuspended:suspended,notificationEnabled:false,...(role==="PROFESSIONAL"?{categoryId:category.id,specialty:category.name}:{})}});users.push(user.id);const token=await new SignJWT({userId:user.id}).setProtectedHeader({alg:"HS256"}).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));return{...user,headers:{Cookie:`session=${token}`,Origin:base,"Content-Type":"application/json"}};}
  async function post(actor,path,body,expected=200,method="POST"){const response=await fetch(base+path,{method,headers:actor?.headers??{Origin:base,"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
  try{
    category=await prisma.serviceCategory.create({data:{name:marker,normalizedName:marker.toLowerCase(),icon:"wrench"}});
    const admin=await account("ADMIN"),pro=await account("PROFESSIONAL"),other=await account("PROFESSIONAL"),client=await account("CLIENT"),suspended=await account("ADMIN",true);
    let offset=0;
    async function intervention(status="BOOKED",bookingStatus="CONFIRMED"){
      const startsAt=new Date(Date.now()-(++offset)*86400000),endsAt=new Date(+startsAt+3600000);
      const row=await prisma.serviceRequest.create({data:{clientId:client.id,professionalId:pro.id,kind:"INTERVENTION",title:marker,message:"Incident fixture",status,booking:{create:{professionalId:pro.id,startsAt,endsAt,status:bookingStatus}}}});requests.push(row.id);return{...row,startsAt,endsAt};
    }
    const late=await intervention("COMPLETED");
    await prisma.requestEvent.createMany({data:[{requestId:late.id,actorId:pro.id,status:"IN_PROGRESS",description:"Start recorded",createdAt:new Date(+late.startsAt+31*60000)},{requestId:late.id,actorId:pro.id,status:"COMPLETED",description:"Work completed",createdAt:late.endsAt}]});
    const review=await prisma.professionalReview.create({data:{requestId:late.id,clientId:client.id,professionalId:pro.id,rating:5,comment:"Original review",published:true}});
    await Promise.all([detectSanctions(late.id),detectSanctions(late.id)]);
    assert.equal(await prisma.professionalSanction.count({where:{requestId:late.id}}),1);
    const lateCase=await prisma.professionalSanction.findFirstOrThrow({where:{requestId:late.id}});
    assert.equal(lateCase.status,"PENDING");assert.equal(await ratingPenalty(pro.id),0);
    const endpoint=`/api/admin/sanctions/${lateCase.id}`;
    const apply={action:"APPLY",reason:"Proof reviewed and arrival time verified",reviewed:"YES"};
    await post(null,endpoint,apply,401);await post(pro,endpoint,apply,403);await post(suspended,endpoint,apply,403);
    await post(admin,endpoint,{...apply,reviewed:"NO"},409);await post(admin,endpoint,{...apply,reason:"short"},400);
    await post(admin,endpoint,apply);await post(admin,endpoint,apply,409);
    assert.equal(await ratingPenalty(pro.id),100);
    assert.equal((await prisma.professionalReview.findUniqueOrThrow({where:{id:review.id}})).rating,5);
    const directory=await fetch(`${base}/api/client/professionnels?q=${encodeURIComponent(marker)}`,{headers:client.headers});assert.equal(directory.status,200);const catalog=await directory.json();assert.equal(catalog.professionals.find(row=>row.id===pro.id).rating,4);
    const absence=await intervention();await detectSanctions(absence.id);
    const noShow=await prisma.professionalSanction.findFirstOrThrow({where:{requestId:absence.id}});assert.equal(noShow.ruleId,"NO_SHOW");assert.equal(noShow.amountMillimes,20000);
    const unperformed=await intervention("COMPLETED");await prisma.complaint.create({data:{clientId:client.id,requestId:unperformed.id,subject:"Intervention non réalisée",message:"Le professionnel indique avoir fini mais le travail est non réalisé."}});await detectSanctions(unperformed.id);
    const notDone=await prisma.professionalSanction.findFirstOrThrow({where:{requestId:unperformed.id}});assert.equal(notDone.ruleId,"UNPERFORMED");assert.equal(notDone.amountMillimes,30000);
    const unconfirmed=await intervention("SENT","PROPOSED");await detectSanctions(unconfirmed.id);assert.equal(await prisma.professionalSanction.count({where:{requestId:unconfirmed.id}}),0,"unconfirmed appointment is not an absence");
    const rules=originals.map(({id,enabled,thresholdMinutes,amountMillimes,ratingHundredths})=>({id,enabled,thresholdMinutes,amountMillimes,ratingHundredths}));
    await post(client,"/api/admin/sanctions/rules",{rules},403,"PUT");
    await post(admin,"/api/admin/sanctions/rules",{rules:rules.map(row=>row.id==="NO_SHOW"?{...row,enabled:false}:row)},200,"PUT");
    await post(admin,`/api/admin/sanctions/${noShow.id}`,apply,409);
    const disabled=await intervention();await detectSanctions(disabled.id);assert.equal(await prisma.professionalSanction.count({where:{requestId:disabled.id}}),0);
    await post(admin,"/api/admin/sanctions/rules",{rules},200,"PUT");
    await Promise.all([post(admin,`/api/admin/sanctions/${noShow.id}`,apply),post(admin,`/api/admin/sanctions/${notDone.id}`,{action:"REJECT",reason:"A justification proves the incident was unfounded"})]);
    assert.equal((await prisma.professionalSanction.aggregate({where:{professionalId:pro.id,status:"APPLIED"},_sum:{amountMillimes:true}}))._sum.amountMillimes,20000);
    const appeal=`/api/professionnel/sanctions/${noShow.id}/appeal`;
    await post(other,appeal,{reason:"This sanction belongs to someone else"},404);await post(client,appeal,{reason:"Not a professional account"},403);
    await post(pro,appeal,{reason:"I arrived and have supporting evidence"});await post(pro,appeal,{reason:"Duplicate appeal must not be recorded"},409);
    await post(admin,`/api/admin/sanctions/${noShow.id}`,{action:"ACCEPT_APPEAL",reason:"Supporting evidence confirms the attendance"});
    assert.equal((await prisma.professionalSanction.findUniqueOrThrow({where:{id:noShow.id}})).status,"REVOKED");
    assert.equal((await prisma.professionalSanction.aggregate({where:{professionalId:pro.id,status:"APPLIED"},_sum:{amountMillimes:true}}))._sum.amountMillimes,0);
    await post(pro,`/api/professionnel/sanctions/${lateCase.id}/appeal`,{reason:"Arrival occurred before the recorded start of work"});
    await post(admin,endpoint,{action:"UPHOLD_APPEAL",reason:"Examined records confirm that the arrival was delayed"});
    assert.equal((await prisma.professionalSanction.findUniqueOrThrow({where:{id:lateCase.id}})).appealStatus,"UPHELD");
    assert.equal(await ratingPenalty(pro.id),100);
    await post(admin,endpoint,{action:"REVOKE",reason:"Arrival verification corrected the recorded delay"});assert.equal(await ratingPenalty(pro.id),0);
    await detectSanctions(late.id);assert.equal(await prisma.professionalSanction.count({where:{requestId:late.id}}),1,"revoked incidents are never recreated");
    assert.equal(await prisma.sanctionHistory.count({where:{sanctionId:noShow.id}}),3);
    assert.ok(await prisma.clientNotification.count({where:{userId:pro.id,type:"SANCTION"}})>=3);
    for(const [actor,path] of [[admin,"/admin/sanctions?tab=rules"],[admin,"/admin/sanctions?tab=history"],[admin,"/admin/sanctions?tab=appeals"],[pro,"/professionnel/revenus"],[pro,"/professionnel/avis"]]){const response=await fetch(base+path,{headers:actor.headers});assert.equal(response.status,200,path);assert.doesNotMatch(await response.text(),/Internal Server Error|Application error:/);}
  }finally{
    for(const row of originals)await prisma.sanctionRule.update({where:{id:row.id},data:{enabled:row.enabled,thresholdMinutes:row.thresholdMinutes,amountMillimes:row.amountMillimes,ratingHundredths:row.ratingHundredths}});
    await prisma.clientNotification.deleteMany({where:{OR:[{userId:{in:users}},{title:{contains:marker}}]}});await prisma.adminAuditLog.deleteMany({where:{actorId:{in:users}}});
    await prisma.complaint.deleteMany({where:{clientId:{in:users}}});await prisma.serviceRequest.deleteMany({where:{id:{in:requests}}});await prisma.user.deleteMany({where:{id:{in:users}}});if(category)await prisma.serviceCategory.delete({where:{id:category.id}});await prisma.$disconnect();
  }
});
