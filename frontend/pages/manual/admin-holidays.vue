<script setup>
definePageMeta({ layout: 'manual' })
</script>
<template>
  <ManualPage slug="admin-holidays" intro="ตั้งวันหยุดของบริษัทแต่ละปี พนักงานจะเห็นวันหยุดเหล่านี้ในปฏิทิน" :related="['holidays', 'admin-leaves', 'home']">
    <ManualStep :n="1" title="เปิดเมนู จัดการวันหยุด">
      <p>เลือกปีจากช่องมุมขวาบน (แสดงเป็น พ.ศ.) ตารางจะแสดงวันที่ วัน และชื่อวันหยุดของปีนั้น</p>
      <ManualShot name="admin-holidays-1" caption="หน้าจัดการวันหยุด" />
    </ManualStep>
    <ManualStep :n="2" title="เพิ่มวันหยุด">
      <p>กดปุ่ม "+ เพิ่มวันหยุด" เลือกวันที่จากปฏิทิน พิมพ์ชื่อวันหยุด แล้วกด "บันทึก"</p>
      <ManualShot name="admin-holidays-2" caption="หน้าต่างเพิ่มวันหยุด" />
      <ManualTip type="warn">ต้องกรอกทั้งวันที่และชื่อ ถ้าวันที่ซ้ำกับวันหยุดที่มีอยู่ ระบบจะไม่ให้บันทึก</ManualTip>
    </ManualStep>
    <ManualStep :n="3" title="แก้ไขหรือลบ">
      <p>กด "แก้ไข" เพื่อเปลี่ยนวันหรือชื่อ กด "ลบ" แล้วยืนยันเพื่อเอาออก</p>
    </ManualStep>
    <ManualStep :n="4" title="คัดลอกจากปีก่อน (ทางลัด)">
      <p>กด "คัดลอกจากปีก่อน" แล้วกด "คัดลอก" ระบบจะนำวันหยุดปีก่อนมาใส่ปีที่เลือกตามวันและเดือนเดิม วันที่มีอยู่แล้วจะถูกข้าม</p>
      <ManualTip type="warn">วันหยุดที่เลื่อนตามปฏิทินจันทรคติ (เช่น วันพระ) ต้องตรวจและแก้เองทุกปี</ManualTip>
    </ManualStep>
  </ManualPage>
</template>
