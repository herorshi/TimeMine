<script setup>
definePageMeta({ layout: 'manual' })
</script>
<template>
  <ManualPage slug="admin-reports" intro="ดูสรุปและรายละเอียดของการเข้างาน การลา OT และเงินเดือน แล้วดาวน์โหลดเป็นไฟล์ได้" :related="['admin-attendance', 'admin-ot', 'admin-leaves']">
    <ManualStep :n="1" title="เปิดเมนู รายงาน และเลือกแท็บ">
      <p>มี 4 แท็บ: "การเข้างาน", "การลา", "OT" และ "เงินเดือน"</p>
      <ManualShot name="admin-reports-1" caption="หน้ารายงาน" />
    </ManualStep>
    <ManualStep :n="2" title="เลือกช่วงเวลา">
      <p>แท็บการเข้างาน การลา และ OT: เลือก "ตั้งแต่วันที่" และ "ถึงวันที่" หรือเลือกทั้งเดือนทีเดียวที่ช่อง "เลือกทั้งเดือน"</p>
      <p>แท็บเงินเดือน: เลือก "เดือน"</p>
      <ManualTip type="warn">ถ้าวันเริ่มมาหลังวันสิ้นสุด จะขึ้นว่า "กรุณาเลือกช่วงเวลาให้ถูกต้อง"</ManualTip>
    </ManualStep>
    <ManualStep :n="3" title="อ่านสรุปและตาราง">
      <p>ด้านบนเป็นการ์ดสรุป เช่น จำนวนพนักงาน คนมาสาย ชั่วโมง OT ที่อนุมัติ ด้านล่างเป็นตารางรายละเอียด ที่หัวคอลัมน์ใช้กรองได้</p>
      <ManualShot name="admin-reports-2" caption="รายงานเงินเดือน" />
      <ManualTip>ยอดเงินเดือนย้อนหลังคำนวณจากเงินเดือนและการตั้งค่าปัจจุบัน ไม่ใช่ค่าตอนนั้น (ดู <ManualLink to="admin-settings" />)</ManualTip>
    </ManualStep>
    <ManualStep :n="4" title="ดาวน์โหลดไฟล์">
      <p>กด "ดาวน์โหลด CSV" หรือ "Export Excel" ที่มุมขวาบน ไฟล์จะเป็นข้อมูลของแท็บและช่วงเวลาที่เลือกอยู่</p>
      <ManualTip>ปุ่มจะกดไม่ได้ขณะกำลังโหลดข้อมูล รอให้ตารางขึ้นก่อน</ManualTip>
    </ManualStep>
  </ManualPage>
</template>
