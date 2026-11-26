<script setup>
definePageMeta({ layout: 'manual' })
</script>

<template>
  <ManualPage slug="exec-permissions" intro="หน้านี้กำหนดว่าพนักงานและ Admin ทำอะไรในระบบได้บ้าง ตั้งได้ 2 แบบ คือกำหนดตามบทบาท (ทุกคนในบทบาทนั้น) หรือกำหนดรายบุคคล" :related="['exec-admins','admin-employees','getting-started']">
    <ManualTip type="info">ผู้บริหารมีสิทธิ์ทุกอย่างเสมอ หน้านี้ไม่มีให้ตั้งสิทธิ์ของผู้บริหาร</ManualTip>

    <ManualStep :n="1" title="เปิดเมนู สิทธิ์การใช้งาน">
      <p>กดเมนู <b>สิทธิ์การใช้งาน</b> จะเห็น 2 แท็บ คือ <b>ตามบทบาท</b> และ <b>รายบุคคล</b></p>
      <ManualShot name="exec-permissions-1" caption="หน้าสิทธิ์การใช้งาน แท็บตามบทบาท" />
    </ManualStep>

    <ManualStep :n="2" title="ตั้งสิทธิ์ตามบทบาท">
      <p>ในแท็บ <b>ตามบทบาท</b> มีตาราง 2 กลุ่ม แต่ละสิทธิ์มีสวิตช์ เปิด (สีเขียว) คืออนุญาต ปิด (สีเทา) คือไม่อนุญาต</p>
      <ul class="list-disc space-y-1 pl-6">
        <li><b>สิทธิ์พนักงาน</b> มีสวิตช์ของ พนักงาน และ Admin แต่ใช้ค่าเดียวกัน เปลี่ยนช่องใดช่องหนึ่ง อีกช่องจะเปลี่ยนตาม</li>
        <li><b>สิทธิ์ Admin</b> มีสวิตช์ของ Admin เท่านั้น</li>
      </ul>
      <p>แถวที่แก้แล้วจะเป็นสีเหลือง และมีข้อความ "มีการเปลี่ยนแปลง ... รายการที่ยังไม่ได้บันทึก"</p>
      <ManualShot name="exec-permissions-2" caption="สวิตช์สิทธิ์ที่แก้แล้ว แถวเป็นสีเหลือง" />
    </ManualStep>

    <ManualStep :n="3" title="บันทึกหรือยกเลิก">
      <p>กด <b>บันทึก</b> เพื่อใช้ค่าใหม่ จะขึ้น "บันทึกสิทธิ์ตามบทบาทแล้ว" ถ้าไม่ต้องการ กด <b>ยกเลิกการแก้ไข</b> เพื่อกลับเป็นค่าเดิม</p>
    </ManualStep>

    <ManualStep :n="4" title="ตั้งสิทธิ์รายบุคคล">
      <p>เปิดแท็บ <b>รายบุคคล</b> ค้นหาด้วย รหัส ชื่อ อีเมล แผนก หรือตำแหน่ง แล้วกดปุ่ม <b>กำหนดสิทธิ์</b> ท้ายแถว (ไม่มีผู้บริหารในรายการ)</p>
      <p>ในหน้าต่างที่เปิด แต่ละสิทธิ์มีตัวเลือก 3 ปุ่ม</p>
      <ul class="list-disc space-y-1 pl-6">
        <li><b>ตามบทบาท</b> ใช้ค่าตามที่ตั้งไว้ในแท็บตามบทบาท</li>
        <li><b>อนุญาต</b> ให้คนนี้ทำได้ ไม่ว่าบทบาทจะตั้งไว้อย่างไร</li>
        <li><b>ไม่อนุญาต</b> ห้ามคนนี้ทำ ไม่ว่าบทบาทจะตั้งไว้อย่างไร</li>
      </ul>
      <p>ใต้ชื่อสิทธิ์จะบอก "ค่าตามบทบาท" และป้ายผล <b>ผล: ใช้งานได้</b> หรือ <b>ผล: ใช้งานไม่ได้</b> ว่าสุดท้ายคนนี้ทำได้หรือไม่ กด <b>บันทึก</b> เมื่อเสร็จ</p>
      <ManualShot name="exec-permissions-3" caption="หน้าต่างกำหนดสิทธิ์รายบุคคล" />
      <ManualTip>ถ้ามีสิทธิ์รายบุคคล ค่านั้นจะชนะค่าตามบทบาทเสมอ ต้องการให้กลับไปใช้ค่าบทบาท ให้กดปุ่ม <b>ตามบทบาท</b></ManualTip>
    </ManualStep>

    <ManualStep :n="5" title="สิทธิ์แต่ละข้อหมายถึงอะไร">
      <p><b>สิทธิ์พนักงาน</b> (ใช้กับทุกบทบาท)</p>
      <ul class="list-disc space-y-1 pl-6">
        <li><b>ลงเวลาเข้างานที่ Office</b> กดเข้างานแบบ Office ได้ ดู <ManualLink to="checkin" /></li>
        <li><b>ลงเวลาเข้างานที่ตึก (สแกนหน้า)</b> เข้างานด้วยการสแกนหน้าที่ตึกได้</li>
        <li><b>ขอ Work from Home</b> ขอทำงานที่บ้านได้</li>
        <li><b>ยื่นลางาน</b> ส่งใบลาได้ ดู <ManualLink to="leave" /></li>
        <li><b>ขอทำ OT</b> ส่งคำขอ OT ได้ ดู <ManualLink to="ot" /></li>
      </ul>
      <p class="mt-3"><b>สิทธิ์ Admin</b> (ใช้กับ Admin) แต่ละข้อเปิดเมนูของ Admin</p>
      <ul class="list-disc space-y-1 pl-6">
        <li><b>ดูการเข้างาน / อนุมัติ WFH</b> ดูการเข้างานของทุกคนและอนุมัติ WFH ดู <ManualLink to="admin-attendance" /></li>
        <li><b>อนุมัติการลา</b> อนุมัติหรือไม่อนุมัติใบลา ดู <ManualLink to="admin-leaves" /></li>
        <li><b>อนุมัติ OT</b> อนุมัติหรือไม่อนุมัติ OT ดู <ManualLink to="admin-ot" /></li>
        <li><b>ออก / ยกเลิกใบเตือน</b> ดู <ManualLink to="admin-warnings" /></li>
        <li><b>จัดการประกาศ</b> สร้างและแก้ประกาศ ดู <ManualLink to="admin-announcements" /></li>
        <li><b>จัดการวันหยุด</b> ดู <ManualLink to="admin-holidays" /></li>
        <li><b>จัดการพนักงาน</b> เพิ่ม แก้ไขข้อมูลพนักงาน รวมถึงลงทะเบียนใบหน้า ดู <ManualLink to="admin-employees" /></li>
        <li><b>ดูรายงาน</b> ดู <ManualLink to="admin-reports" /></li>
        <li><b>ตั้งค่าระบบ</b> ดู <ManualLink to="admin-settings" /></li>
        <li><b>ประเมิน KPI พนักงาน</b> ให้คะแนน KPI ดู <ManualLink to="admin-kpi" /></li>
      </ul>
      <ManualTip type="warn">ถ้าปิดสิทธิ์ของใคร เมนูนั้นจะหายไปจากเมนูของเขา และถ้าเขาพยายามใช้ ระบบจะตอบว่า "คุณไม่ได้รับสิทธิ์ใช้งานส่วนนี้ กรุณาติดต่อผู้บริหาร"</ManualTip>
    </ManualStep>
  </ManualPage>
</template>
