import{expect,test}from'bun:test';
if(process.env.NESOMN_DISPOSABLE_TESTS!=='1'||process.env.DATABASE_URL!=='postgresql://nesomn_test:nesomn_test@127.0.0.1:55432/nesomn_revision_test')throw Error('Disposable fixed DB only');
const{db,sql}=await import('../api/src/db/client.ts');const{users,projects,assets}=await import('../api/src/db/schema/index.ts');const{eq}=await import('../api/node_modules/drizzle-orm');const{app}=await import('../api/src/index.ts');const{createSession}=await import('../api/src/modules/session/service.ts');const{signToken}=await import('../api/src/lib/jwt.ts');
test('scene3D catalog identity/legacy decal fields/optional mesh target roundtrip and ownership',async()=>{
 const[email]=['phase8-'+crypto.randomUUID()+'@test.invalid'];const[user]=await db.insert(users).values({email,name:'Demo / Sample3D test',role:'admin'}).returning();const[other]=await db.insert(users).values({email:'other-'+email,name:'Sample other'}).returning();let assetId:string|undefined;
 try{
 const[asset]=await db.insert(assets).values({slug:'phase8-'+crypto.randomUUID(),title:'Demo / Sample3D',type:'asset3d',editorType:'product_3d_editor',status:'published',isMarketplace:true,glbFile:'assets/sample3d.glb'}).returning();assetId=asset!.id;
 const session=await createSession(user!.id,null,null),cookie='nesomn_session='+await signToken({sub:user!.id,sessionId:session,role:'admin'});const otherSession=await createSession(other!.id,null,null),otherCookie='nesomn_session='+await signToken({sub:other!.id,sessionId:otherSession,role:'user'});
 const state={modelKey:asset!.slug,background:'#eeeeee',materialColor:'#d6d3cc',grain:12,camera:'side',decals:[{id:'sample',src:'data:image/png;base64,sample',position:[0,0,.5],rotation:[0,0,0],scale:.6,meshPath:'0.0'}]};
 const created=await app.handle(new Request('http://localhost/projects',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({title:'Sample3D',kind:'scene3d',state})}));expect(created.status).toBe(200);const project=await created.json();
 const loaded=await app.handle(new Request('http://localhost/projects/'+project.id,{headers:{cookie}}));expect((await loaded.json()).state).toEqual(state);
 const update=await app.handle(new Request('http://localhost/projects/'+project.id,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({state:{...state,camera:'front'}})}));expect(update.status).toBe(200);expect((await update.json()).state.modelKey).toBe(asset!.slug);
 const foreign=await app.handle(new Request('http://localhost/projects/'+project.id,{headers:{cookie:otherCookie}}));expect(foreign.status).toBe(404);
 const model=await app.handle(new Request('http://localhost/catalog/editor-asset/'+asset!.slug,{headers:{cookie}}));expect(model.status).toBe(200);expect((await model.json()).modelUrl).toContain('/files/');
 }finally{await db.delete(projects).where(eq(projects.userId,user!.id));await db.delete(users).where(eq(users.id,user!.id));await db.delete(users).where(eq(users.id,other!.id));if(assetId)await db.delete(assets).where(eq(assets.id,assetId));}
});
test('close isolated SQL client',async()=>{await sql.end();expect(true).toBe(true);});
