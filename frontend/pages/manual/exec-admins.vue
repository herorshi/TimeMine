<script setup>
definePageMeta({ layout: 'manual' })
</script>

<template>
  <ManualPage slug="exec-admins" intro="หน้านี้ใช้เพิ่ม แก้ไข และลบบัญชีของ Admin และผู้บริหาร บัญชีพนักงานทั่วไปจัดการที่หน้าอื่น" :related="['exec-permissions','admin-employees','getting-started']">
    <ManualStep :n="1" title="เปิดเมนู จัดการ Admin">
      <p>กดเมนู <b>จัดการ Admin</b> จะเห็นตารางบัญชีที่เป็น Admin หรือผู้บริหารเท่านั้น มีชื่อ เพศ แผนก ตำแหน่ง สิทธิ์ สถานะ และเงินเดือน</p>
      <ManualShot name="exec-admins-1" caption="หน้าจัดการผู้ดูแลระบบ" />
    </ManualStep>

    <ManualStep :n="2" title="เพิ่มบัญชีใหม่">
      <p>กดปุ่ม <b>+ เพิ่มบัญชี</b> มุมขวาบน</p>
    </ManualStep>

    <ManualStep :n="3" title="กรอกข้อมูล">
      <p>กรอกช่อง รหัสพนักงาน, ชื่อ-นามสกุล, อีเมล, รหัสผ่าน (อย่างน้อย 6 ตัวอักษร), เพศ, แผนก, ตำแหน่ง และเงินเดือน (บาท)</p>
      <p>ช่อง <b>สิทธิ์การใช้งาน</b> เลือกได้ 2 แบบ คือ <b>Admin</b> หรือ <b>ผู้บริหาร</b></p>
      <ManualShot name="exec-admins-2" caption="ฟอร์มเพิ่มบัญชี" />
      <ManualTip type="warn">ผู้บริหารมีสิทธิ์ทุกอย่างและตั้งจำกัดสิทธิ์ไม่ได้ ถ้าต้องการจำกัดสิทธิ์ ให้เลือก Admin แล้วไปตั้งที่ <ManualLink to="exec-permissions" /></ManualTip>
    </ManualStep>

    <ManualStep :n="4" title="บันทึก">
      <p>กดปุ่ม <b>บันทึก</b> เมื่อสำเร็จจะขึ้น "เพิ่มบัญชีแล้ว" และบัญชีใหม่โผล่ในตาราง</p>
    </ManualStep>

    <ManualStep :n="5" title="แก้ไขบัญชี">
      <p>กดปุ่ม <b>แก้ไข</b> ท้ายแถว แก้ข้อมูลแล้วกด <b>บันทึก</b> ช่องรหัสผ่านจะไม่โชว์ตอนแก้ไข</p>
      <ManualTip type="info">ถ้าแก้ไขบัญชีของตัวเอง จะเปลี่ยนสิทธิ์การใช้งานของตัวเองไม่ได้</ManualTip>
    </ManualStep>

    <ManualStep :n="6" title="ลบบัญชี">
      <p>กดปุ่ม <b>ลบ</b> ท้ายแถว แล้วกด <b>ลบถาวร</b> ในหน้าต่างยืนยัน ปุ่มลบจะไม่มีในแถวของตัวเอง</p>
      <ManualTip type="warn">การลบเป็นแบบถาวร ข้อมูลการเข้างาน การลา OT และใบเตือนของบัญชีนั้นหายหมดและกู้คืนไม่ได้</ManualTip>
    </ManualStep>
  </ManualPage>
</template>
